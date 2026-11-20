/**
 * „Passwort vergessen“ für lokale Konten (Kap. 4.2, ASVS V2.5).
 *
 * - Antwort und Laufzeit verraten nicht, ob es die Adresse gibt: Die Anfrage
 *   wird im Hintergrund bearbeitet.
 * - Im Link steht ein zufälliges Token; gespeichert wird nur sein SHA-256.
 *   Gültig 15/30/60 Minuten (Verwaltung → Anmeldung), nur einmal.
 * - Höchstens 3 Links je Konto und Stunde, je IP 10 Anfragen je Stunde.
 * - Nach dem Zurücksetzen enden alle Sitzungen; der zweite Faktor bleibt
 *   nötig. Die Person bekommt eine Bestätigung per E-Mail.
 */
import { and, count, eq, gt, isNull, lt, sql, TransactionRollbackError } from 'drizzle-orm';
import { audit } from '../audit.ts';
import { randomToken, sha256Hex } from '../crypto.ts';
import { db } from '../db/index.ts';
import { localCredentials, passwordResets, persons } from '../db/schema.ts';
import { escapeHtml, mailConfigured, sendMail } from '../mail.ts';
import { passwordPolicy } from './local.ts';
import { hashPassword } from './password.ts';
import { endAllSessions } from './session.ts';

const PER_PERSON_HOUR = 3;
const PER_IP_HOUR = 10;
const ipHits = new Map<string, number[]>();

/** true, wenn diese IP noch anfragen darf (zählt die Anfrage mit). */
export function allowResetRequest(ip: string, now = Date.now()): boolean {
	const since = now - 3_600_000;
	const hits = (ipHits.get(ip) ?? []).filter((t) => t > since);
	if (hits.length >= PER_IP_HOUR) {
		ipHits.set(ip, hits);
		return false;
	}
	hits.push(now);
	ipHits.set(ip, hits);
	// Speicher begrenzen
	if (ipHits.size > 10_000) for (const k of ipHits.keys()) if (k !== ip) ipHits.delete(k);
	return true;
}

export async function resetAvailable(): Promise<boolean> {
	return mailConfigured();
}

async function localAccount(email: string) {
	const [row] = await db
		.select({
			id: persons.id,
			tenantId: persons.tenantId,
			displayName: persons.displayName,
			email: persons.email
		})
		.from(persons)
		.innerJoin(localCredentials, eq(localCredentials.personId, persons.id))
		.where(
			and(
				sql`lower(${persons.email}) = lower(${email.trim()})`,
				eq(persons.authSource, 'local'),
				eq(persons.status, 'active'),
				sql`${localCredentials.passwordHash} is not null`
			)
		);
	return row ?? null;
}

/** Bearbeitet die Anfrage. Wirft nicht; Ergebnis nur im Protokoll. */
export async function requestPasswordReset(email: string, origin: string, ip: string) {
	try {
		const person = email.includes('@') ? await localAccount(email.slice(0, 320)) : null;
		if (!person) {
			await audit({
				category: 'security',
				action: 'password.reset_requested',
				details: { bekannt: false },
				ip
			});
			return;
		}
		const [{ n }] = await db
			.select({ n: count() })
			.from(passwordResets)
			.where(
				and(
					eq(passwordResets.personId, person.id),
					gt(passwordResets.createdAt, sql`now() - interval '1 hour'`)
				)
			);
		if (n >= PER_PERSON_HOUR) {
			await audit({
				category: 'security',
				action: 'password.reset_throttled',
				actorId: person.id,
				tenantId: person.tenantId,
				ip
			});
			return;
		}
		const { resetMinutes } = await passwordPolicy();
		const token = randomToken();
		await db.insert(passwordResets).values({
			tokenHash: sha256Hex(token),
			personId: person.id,
			expiresAt: new Date(Date.now() + resetMinutes * 60_000)
		});
		const link = new URL(`/anmelden/passwort-neu/${token}`, origin).href;
		await sendMail({
			to: person.email,
			subject: 'Passwort für das Intranet zurücksetzen',
			text: `Hallo ${person.displayName},\n\ndu hast ein neues Passwort für das Intranet angefordert. Leg es hier fest:\n${link}\n\nDer Link gilt ${resetMinutes} Minuten und nur einmal. Deinen zweiten Faktor brauchst du danach weiterhin.\n\nWarst du das nicht? Dann ignoriere diese E-Mail; dein Passwort bleibt unverändert.`,
			html: `<p>Hallo ${escapeHtml(person.displayName)},</p><p>du hast ein neues Passwort für das Intranet angefordert. Leg es hier fest:</p><p><a href="${escapeHtml(link)}">Neues Passwort festlegen</a></p><p>Der Link gilt ${resetMinutes} Minuten und nur einmal. Deinen zweiten Faktor brauchst du danach weiterhin.</p><p>Warst du das nicht? Dann ignoriere diese E-Mail; dein Passwort bleibt unverändert.</p>`
		});
		await audit({
			category: 'security',
			action: 'password.reset_requested',
			actorId: person.id,
			tenantId: person.tenantId,
			details: { bekannt: true },
			ip
		});
	} catch (err) {
		console.error('Passwort-Link konnte nicht verschickt werden:', err);
	}
}

export async function findReset(token: string) {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
	const [row] = await db
		.select({
			personId: passwordResets.personId,
			email: persons.email,
			displayName: persons.displayName
		})
		.from(passwordResets)
		.innerJoin(persons, eq(persons.id, passwordResets.personId))
		.innerJoin(localCredentials, eq(localCredentials.personId, persons.id))
		.where(
			and(
				sql`${localCredentials.passwordHash} is not null`,
				eq(passwordResets.tokenHash, sha256Hex(token)),
				isNull(passwordResets.usedAt),
				gt(passwordResets.expiresAt, new Date()),
				eq(persons.status, 'active'),
				eq(persons.authSource, 'local')
			)
		);
	return row ?? null;
}

/** Setzt das Passwort, verbraucht alle offenen Links der Person und beendet alle Sitzungen. */
export async function completeReset(token: string, personId: string, password: string, ip: string) {
	const passwordHash = await hashPassword(password);
	const ok = await db
		.transaction(async (tx) => {
			const used = await tx
				.update(passwordResets)
				.set({ usedAt: new Date() })
				.where(
					and(
						eq(passwordResets.tokenHash, sha256Hex(token)),
						isNull(passwordResets.usedAt),
						gt(passwordResets.expiresAt, new Date())
					)
				)
				.returning({ personId: passwordResets.personId });
			if (used.length !== 1 || used[0].personId !== personId) return false;
			await tx
				.update(passwordResets)
				.set({ usedAt: new Date() })
				.where(and(eq(passwordResets.personId, personId), isNull(passwordResets.usedAt)));
			const gesetzt = await tx
				.update(localCredentials)
				.set({ passwordHash, passwordChangedAt: new Date(), failedAttempts: 0, lastFailedAt: null })
				.where(eq(localCredentials.personId, personId))
				.returning({ personId: localCredentials.personId });
			// Ohne Zugangsdaten (sollte es nicht geben): nichts verbrauchen
			if (gesetzt.length !== 1) tx.rollback();
			return true;
		})
		.catch((err) => {
			if (err instanceof TransactionRollbackError) return false;
			throw err;
		});
	if (!ok) return false;
	await endAllSessions(personId);
	const [p] = await db
		.select({ email: persons.email, name: persons.displayName, tenantId: persons.tenantId })
		.from(persons)
		.where(eq(persons.id, personId));
	await audit({
		category: 'security',
		action: 'password.reset',
		actorId: personId,
		tenantId: p?.tenantId,
		ip
	});
	if (p)
		await sendMail({
			to: p.email,
			subject: 'Dein Passwort für das Intranet wurde geändert',
			text: `Hallo ${p.name},\n\ndein Passwort für das Intranet wurde soeben geändert. Alle Anmeldungen wurden beendet.\n\nWarst du das nicht? Dann wende dich bitte sofort an die IT.`,
			html: `<p>Hallo ${escapeHtml(p.name)},</p><p>dein Passwort für das Intranet wurde soeben geändert. Alle Anmeldungen wurden beendet.</p><p>Warst du das nicht? Dann wende dich bitte sofort an die IT.</p>`
		}).catch((err) => console.error('Bestätigung nicht verschickt:', err));
	return true;
}

/** Aufräumen: abgelaufene oder benutzte Links nach einem Tag löschen. */
export async function deleteOldResets() {
	await db
		.delete(passwordResets)
		.where(lt(passwordResets.expiresAt, sql`now() - interval '1 day'`));
}
