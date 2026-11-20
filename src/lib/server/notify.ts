/**
 * Benachrichtigungen (Kap. 11): Glocke und E-Mail.
 * - notify(): legt Einträge je Person nach ihren Einstellungen an.
 * - dispatchNews(): meldet Neuigkeiten beim Veröffentlichen (auch geplante).
 * - sendEmails(): sofort bzw. als Zusammenfassung (täglich/wöchentlich um 7 Uhr).
 * Läuft minütlich im Anwendungsprozess (startNotifier).
 */
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { berlinNow } from '../canteen.ts';
import { digestModesDue, resolveNotify, TOPICS, type NotifySettings } from '../notify.ts';
import { db } from './db/index.ts';
import { news, notifications, personPreferences, persons, units } from './db/schema.ts';
import { escapeHtml, mailConfigured, sendMail } from './mail.ts';
import { getSetting, setSetting } from './settings.ts';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aktive Personen ohne Betreiber-Konten */
const regularPerson = and(
	sql`${persons.status} <> 'disabled'`,
	sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
);

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

export async function getNotify(personId: string) {
	const [row] = await db
		.select({ n: personPreferences.notify })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return resolveNotify(row?.n);
}

export async function setNotify(personId: string, settings: NotifySettings) {
	const clean = resolveNotify(settings);
	await db
		.insert(personPreferences)
		.values({ personId, notify: clean })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { notify: clean } });
}

// ---------------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------------

export interface NotifyContent {
	title: string;
	detail?: string | null;
	link: string;
}

/** Benachrichtigt die Personen nach ihren Einstellungen für dieses Thema. */
export async function notify(topic: string, personIds: string[], content: NotifyContent) {
	if (!TOPICS.some((t) => t.key === topic) || personIds.length === 0) return 0;
	let count = 0;
	for (let i = 0; i < personIds.length; i += 1000) {
		const chunk = personIds.slice(i, i + 1000);
		const rows = await db
			.select({ id: persons.id, n: personPreferences.notify })
			.from(persons)
			.leftJoin(personPreferences, eq(personPreferences.personId, persons.id))
			.where(and(inArray(persons.id, chunk), regularPerson));
		const values = rows
			.map((r) => ({ id: r.id, s: resolveNotify(r.n).topics[topic] }))
			.filter((r) => r.s.bell || r.s.email)
			.map((r) => ({
				personId: r.id,
				topic,
				title: content.title.slice(0, 200),
				detail: content.detail?.slice(0, 200) ?? null,
				link: content.link,
				bell: r.s.bell,
				email: r.s.email ? ('pending' as const) : null
			}));
		if (values.length) await db.insert(notifications).values(values);
		count += values.length;
	}
	return count;
}

/** Alle regulären Personen eines oder mehrerer Mandanten (null = alle). */
export async function personsOfTenants(tenantIds: string[] | null) {
	const rows = await db
		.select({ id: persons.id })
		.from(persons)
		.where(and(regularPerson, tenantIds ? inArray(persons.tenantId, tenantIds) : undefined));
	return rows.map((r) => r.id);
}

/**
 * Neuigkeiten beim Veröffentlichen melden (Kap. 8.1). Wird ein Beitrag
 * nachträglich dringend, folgt eine Meldung als „Dringend“.
 */
export async function dispatchNews(now = new Date()) {
	const due = await db
		.select({
			id: news.id,
			title: news.title,
			unitName: units.name,
			allTenants: news.allTenants,
			pinnedUntil: news.pinnedUntil,
			urgentUntil: news.urgentUntil,
			notifiedAt: news.notifiedAt
		})
		.from(news)
		.innerJoin(units, eq(units.id, news.unitId))
		.where(
			and(
				lte(news.publishAt, now),
				or(isNull(news.expiresAt), gt(news.expiresAt, now)),
				or(isNull(news.notifiedAt), and(eq(news.notifiedUrgent, false), gt(news.urgentUntil, now)))
			)
		)
		.limit(50);
	for (const n of due) {
		const urgent = n.urgentUntil !== null && n.urgentUntil > now;
		// Erst markieren, dann melden: so meldet kein zweiter Lauf doppelt
		const claimed = await db
			.update(news)
			.set({ notifiedAt: now, notifiedUrgent: urgent })
			.where(
				and(
					eq(news.id, n.id),
					n.notifiedAt === null ? isNull(news.notifiedAt) : eq(news.notifiedUrgent, false)
				)
			)
			.returning({ id: news.id });
		if (!claimed.length) continue;
		const topic = urgent
			? 'dringend'
			: n.pinnedUntil !== null && n.pinnedUntil > now
				? 'angeheftet'
				: 'neuigkeiten';
		let tenantIds: string[] | null = null;
		if (!n.allTenants) {
			const rows = await db.execute<{ tenant_id: string }>(
				sql`select tenant_id from news_tenants where news_id = ${n.id}`
			);
			tenantIds = rows.map((r) => r.tenant_id);
		}
		const recipients = await personsOfTenants(tenantIds);
		await notify(topic, recipients, {
			title: n.title,
			detail: n.unitName,
			link: `/neuigkeiten/${n.id}`
		});
	}
}

// ---------------------------------------------------------------------------
// Glocke
// ---------------------------------------------------------------------------

export async function unreadCount(personId: string): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(notifications)
		.where(
			and(
				eq(notifications.personId, personId),
				eq(notifications.bell, true),
				isNull(notifications.readAt)
			)
		);
	return row?.n ?? 0;
}

export async function listNotifications(personId: string, limit = 100) {
	return db
		.select({
			id: notifications.id,
			topic: notifications.topic,
			title: notifications.title,
			detail: notifications.detail,
			createdAt: notifications.createdAt,
			readAt: notifications.readAt
		})
		.from(notifications)
		.where(and(eq(notifications.personId, personId), eq(notifications.bell, true)))
		.orderBy(desc(notifications.createdAt))
		.limit(limit);
}

/** Als gelesen markieren; liefert das Ziel (nur interne Pfade). */
export async function openNotification(personId: string, id: string): Promise<string | null> {
	if (!GUID.test(id)) return null;
	const [row] = await db
		.update(notifications)
		.set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
		.where(and(eq(notifications.id, id), eq(notifications.personId, personId)))
		.returning({ link: notifications.link });
	if (!row) return null;
	return row.link.startsWith('/') && !row.link.startsWith('//') ? row.link : '/';
}

export async function markAllRead(personId: string) {
	await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(and(eq(notifications.personId, personId), isNull(notifications.readAt)));
}

// ---------------------------------------------------------------------------
// E-Mail
// ---------------------------------------------------------------------------

function origin(): string {
	return (process.env.ORIGIN ?? '').replace(/\/$/, '');
}

const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));

interface Pending {
	id: string;
	topic: string;
	title: string;
	detail: string | null;
	link: string;
}

function mailFor(name: string, items: Pending[], digest: boolean) {
	const base = origin();
	const first = items[0];
	const subject =
		items.length === 1 && !digest
			? `${first.topic === 'dringend' ? 'Dringend: ' : ''}${first.title}`
			: `${digest ? 'Zusammenfassung: ' : ''}${items.length} ${items.length === 1 ? 'neue Benachrichtigung' : 'neue Benachrichtigungen'} im Intranet`;
	const line = (n: Pending) =>
		`${TOPIC_LABEL[n.topic] ?? n.topic}: ${n.title}${n.detail ? ` (${n.detail})` : ''}\n${base}${n.link}`;
	const text = `Hallo ${name},\n\n${items.map(line).join('\n\n')}\n\nDeine Einstellungen: ${base}/konto/benachrichtigungen`;
	const html = `<p>Hallo ${escapeHtml(name)},</p><ul>${items
		.map(
			(n) =>
				`<li><strong>${escapeHtml(TOPIC_LABEL[n.topic] ?? n.topic)}:</strong> <a href="${escapeHtml(base + n.link)}">${escapeHtml(n.title)}</a>${n.detail ? ` – ${escapeHtml(n.detail)}` : ''}</li>`
		)
		.join(
			''
		)}</ul><p style="color:#525C57;font-size:13px">Deine Einstellungen: <a href="${escapeHtml(`${base}/konto/benachrichtigungen`)}">Konto → Benachrichtigungen</a></p>`;
	return { subject, text, html };
}

async function sendBatch(modes: string[], digest: boolean, before?: Date) {
	const rows = await db
		.select({
			nid: notifications.id,
			personId: persons.id,
			email: persons.email,
			name: persons.displayName,
			pref: personPreferences.notify,
			topic: notifications.topic,
			title: notifications.title,
			detail: notifications.detail,
			link: notifications.link
		})
		.from(notifications)
		.innerJoin(persons, eq(persons.id, notifications.personId))
		.leftJoin(personPreferences, eq(personPreferences.personId, persons.id))
		.where(
			and(
				eq(notifications.email, 'pending'),
				regularPerson,
				before ? lt(notifications.createdAt, before) : undefined
			)
		)
		.orderBy(asc(notifications.createdAt))
		.limit(5000);
	const byPerson = new Map<string, { email: string; name: string; items: Pending[] }>();
	for (const r of rows) {
		if (!modes.includes(resolveNotify(r.pref).emailMode)) continue;
		const entry = byPerson.get(r.personId) ?? { email: r.email, name: r.name, items: [] };
		entry.items.push({ id: r.nid, topic: r.topic, title: r.title, detail: r.detail, link: r.link });
		byPerson.set(r.personId, entry);
	}
	for (const { email, name, items } of byPerson.values()) {
		try {
			await sendMail({ to: email, ...mailFor(name.split(/\s+/)[0], items, digest) });
			await db
				.update(notifications)
				.set({ email: 'sent' })
				.where(
					inArray(
						notifications.id,
						items.map((i) => i.id)
					)
				);
		} catch (err) {
			console.error('Benachrichtigung per E-Mail fehlgeschlagen:', err);
		}
	}
}

/** Sofort-Mails jede Minute; Zusammenfassungen einmal am Tag ab 7 Uhr. */
export async function sendEmails(now = new Date()) {
	if (!(await mailConfigured())) return;
	await sendBatch(['sofort'], false);
	const n = berlinNow(now);
	const last = await getSetting<string | null>('notify.digest_last', null);
	const modes = digestModesDue(n, last);
	if (modes.length) {
		await setSetting('notify.digest_last', n.date, null);
		await sendBatch(modes, true, now);
	}
}

/** Löschfrist Glocke: 90 Tage (einstellbar, Kap. 15). */
export async function deleteOldNotifications() {
	const days = Math.max(1, Number(await getSetting('retention.notifications_days', 90)) || 90);
	await db
		.delete(notifications)
		.where(lt(notifications.createdAt, sql`now() - make_interval(days => ${days})`));
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startNotifier(intervalMs = 60_000) {
	if (timer) return;
	let running = false;
	const run = async () => {
		if (running) return;
		running = true;
		try {
			await dispatchNews();
			await sendEmails();
		} catch (err) {
			console.error('Benachrichtigungen fehlgeschlagen:', err);
		} finally {
			running = false;
		}
	};
	void run();
	timer = setInterval(run, intervalMs);
	timer.unref();
}
