/**
 * Web Push (Kap. 11.1) per VAPID. Die Schlüssel erzeugt die Anwendung beim
 * ersten Bedarf und speichert den privaten Schlüssel verschlüsselt
 * (ENCRYPTION_KEY). Gesendet wird nur an bekannte Push-Dienste (SSRF-Schutz).
 *
 * Inhalt einer Push-Nachricht: Titel, kurzer Zusatz und Link – wie bei Teams
 * (Kap. 11.1), keine Beitragstexte.
 */
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { generateVAPIDKeys, sendNotification, WebPushError } from 'web-push';
import {
	deviceLabel,
	isAllowedPushEndpoint,
	isValidSubscriptionKeys,
	safePushLink
} from '../push.ts';
import type { Principal } from './auth/access.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import { db } from './db/index.ts';
import { notifications, pushSubscriptions } from './db/schema.ts';
import { getSetting, setSetting } from './settings.ts';

export class PushError extends Error {}

const MAX_DEVICES = 10;
const MAX_FAILURES = 5;

interface StoredVapid {
	publicKey: string;
	privateKeyEnc: string;
}

let cached: { publicKey: string; privateKey: string } | null = null;

/** VAPID-Schlüssel; beim ersten Aufruf erzeugt und verschlüsselt gespeichert. */
export async function vapidKeys() {
	if (cached) return cached;
	let stored = await getSetting<StoredVapid | null>('push.vapid', null);
	if (!stored) {
		const keys = generateVAPIDKeys();
		stored = {
			publicKey: keys.publicKey,
			privateKeyEnc: encryptSecret(new TextEncoder().encode(keys.privateKey))
		};
		await setSetting('push.vapid', stored, null);
		// Gleichzeitiger Start: die gespeicherte Fassung gewinnt
		stored = (await getSetting<StoredVapid | null>('push.vapid', null)) ?? stored;
	}
	cached = {
		publicKey: stored.publicKey,
		privateKey: new TextDecoder().decode(decryptSecret(stored.privateKeyEnc))
	};
	return cached;
}

export function pushContact(): string {
	const c = process.env.PUSH_CONTACT?.trim();
	if (c && /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(c)) return c;
	return 'mailto:it@example.org';
}

// ---------------------------------------------------------------------------
// Geräte
// ---------------------------------------------------------------------------

export async function subscribe(
	p: Principal,
	input: { endpoint: string; p256dh: string; auth: string },
	userAgent: string
) {
	if (!isAllowedPushEndpoint(input.endpoint))
		throw new PushError('Dieser Push-Dienst wird nicht unterstützt.');
	if (!isValidSubscriptionKeys(input.p256dh, input.auth))
		throw new PushError('Ungültiges Push-Abo.');
	const label = deviceLabel(userAgent.slice(0, 400));
	await db
		.insert(pushSubscriptions)
		.values({ personId: p.personId, ...input, label })
		// Gerät wechselt die Person (Abmelden und anders anmelden): Abo umhängen
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { personId: p.personId, p256dh: input.p256dh, auth: input.auth, label, failures: 0 }
		});
	// Höchstens 10 Geräte je Person: älteste fallen weg
	const rows = await db
		.select({ id: pushSubscriptions.id })
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.personId, p.personId))
		.orderBy(sql`${pushSubscriptions.createdAt} desc`);
	if (rows.length > MAX_DEVICES)
		await db.delete(pushSubscriptions).where(
			inArray(
				pushSubscriptions.id,
				rows.slice(MAX_DEVICES).map((r) => r.id)
			)
		);
}

export async function unsubscribe(p: Principal, endpoint: string) {
	await db
		.delete(pushSubscriptions)
		.where(
			and(eq(pushSubscriptions.personId, p.personId), eq(pushSubscriptions.endpoint, endpoint))
		);
}

export async function removeDevice(p: Principal, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return;
	await db
		.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.personId, p.personId), eq(pushSubscriptions.id, id)));
}

export async function listDevices(p: Principal) {
	return db
		.select({
			id: pushSubscriptions.id,
			label: pushSubscriptions.label,
			endpoint: pushSubscriptions.endpoint,
			createdAt: pushSubscriptions.createdAt,
			lastSuccessAt: pushSubscriptions.lastSuccessAt
		})
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.personId, p.personId))
		.orderBy(asc(pushSubscriptions.createdAt));
}

// ---------------------------------------------------------------------------
// Senden
// ---------------------------------------------------------------------------

export interface PushPayload {
	title: string;
	body?: string | null;
	link: string;
	/** Gleicher tag ersetzt eine ältere Meldung auf dem Gerät */
	tag?: string;
	urgent?: boolean;
}

/** An alle Geräte einer Person; liefert die Zahl erfolgreicher Zustellungen. */
export async function sendToPerson(personId: string, payload: PushPayload): Promise<number> {
	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.personId, personId));
	if (!subs.length) return 0;
	const keys = await vapidKeys();
	const body = JSON.stringify({
		title: payload.title.slice(0, 200),
		body: payload.body?.slice(0, 200) ?? '',
		link: safePushLink(payload.link),
		tag: payload.tag
	});
	let ok = 0;
	for (const s of subs) {
		// Gespeicherte Endpunkte erneut prüfen (Verteidigung in der Tiefe)
		if (!isAllowedPushEndpoint(s.endpoint)) {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
			continue;
		}
		try {
			await sendNotification(
				{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
				body,
				{
					TTL: 24 * 3600,
					urgency: payload.urgent ? 'high' : 'normal',
					timeout: 10_000,
					vapidDetails: { subject: pushContact(), ...keys }
				}
			);
			ok++;
			await db
				.update(pushSubscriptions)
				.set({ failures: 0, lastSuccessAt: new Date() })
				.where(eq(pushSubscriptions.id, s.id));
		} catch (err) {
			const status = err instanceof WebPushError ? err.statusCode : 0;
			// 404/410: Abo gibt es nicht mehr
			if (status === 404 || status === 410 || s.failures + 1 >= MAX_FAILURES)
				await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
			else
				await db
					.update(pushSubscriptions)
					.set({ failures: s.failures + 1 })
					.where(eq(pushSubscriptions.id, s.id));
		}
	}
	return ok;
}

let running = false;

/**
 * Fällige Push-Nachrichten senden. Mehrere fällige Einträge einer Person
 * (z. B. nach der Ruhezeit) gehen gesammelt als eine Nachricht raus.
 */
export async function sendDuePushes(now = new Date()) {
	if (running) return;
	running = true;
	try {
		const due = await db
			.update(notifications)
			.set({ push: 'sent' })
			.where(
				and(
					eq(notifications.push, 'pending'),
					or(isNull(notifications.pushAfter), lte(notifications.pushAfter, now))
				)
			)
			.returning({
				id: notifications.id,
				personId: notifications.personId,
				topic: notifications.topic,
				title: notifications.title,
				detail: notifications.detail,
				link: notifications.link
			});
		const byPerson = new Map<string, typeof due>();
		for (const n of due) byPerson.set(n.personId, [...(byPerson.get(n.personId) ?? []), n]);
		for (const [personId, list] of byPerson) {
			const first = list[0];
			await sendToPerson(
				personId,
				list.length === 1
					? {
							title: first.title,
							body: first.detail,
							link: first.link,
							tag: first.id,
							urgent: first.topic === 'dringend'
						}
					: {
							title: `${list.length} neue Benachrichtigungen`,
							body: list
								.slice(0, 3)
								.map((n) => n.title)
								.join(' · '),
							link: '/benachrichtigungen',
							tag: 'sammlung',
							urgent: list.some((n) => n.topic === 'dringend')
						}
			);
		}
	} finally {
		running = false;
	}
}

/** Für Verwaltung: Zustand von Web Push. */
export async function pushStatus() {
	const [{ n, persons }] = await db
		.select({
			n: sql<number>`count(*)::int`,
			persons: sql<number>`count(distinct ${pushSubscriptions.personId})::int`
		})
		.from(pushSubscriptions);
	const [{ waiting }] = await db
		.select({ waiting: sql<number>`count(*)::int` })
		.from(notifications)
		.where(eq(notifications.push, 'pending'));
	return {
		devices: n,
		persons,
		waiting,
		contact: pushContact(),
		keys: Boolean(await getSetting<StoredVapid | null>('push.vapid', null))
	};
}
