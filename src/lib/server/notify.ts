/**
 * Benachrichtigungen (Kap. 11): Glocke und E-Mail.
 * - notify(): legt Einträge je Person nach ihren Einstellungen an.
 * - dispatchNews(): meldet Neuigkeiten beim Veröffentlichen (auch geplante).
 * - sendEmails(): sofort bzw. als Zusammenfassung (täglich/wöchentlich um 7 Uhr).
 * Läuft minütlich im Anwendungsprozess (startNotifier).
 */
import { vorname } from '../vorname.ts';
import { track } from './jobs.ts';
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { berlinNow } from '../canteen.ts';
import {
	deliverAfter,
	digestModesDue,
	isAbsent,
	resolveNotify,
	TOPICS,
	type Absence,
	type NotifySettings,
	type QuietHours
} from '../notify.ts';
import { getRetention } from './retention.ts';
import { db } from './db/index.ts';
import { news, notifications, personPreferences, persons, units } from './db/schema.ts';
import { escapeHtml, mailConfigured, sendMail } from './mail.ts';
import { getSetting, setSetting } from './settings.ts';
import { teamsActive } from './teams-config.ts';

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

/** Push-Zeitpunkt nach Abwesenheit und Ruhezeiten der Person (null = sofort). */
function pushTiming(
	topic: string,
	s: { quiet: QuietHours; absence: Absence | null },
	now: Date,
	cache: Map<string, Date | null>
) {
	const key = JSON.stringify([topic, s.quiet, s.absence]);
	if (!cache.has(key)) cache.set(key, deliverAfter(topic, now, s));
	return cache.get(key) ?? null;
}

interface Row {
	personId: string;
	bell: boolean;
	push: boolean;
	email: boolean;
	/** Nur Microsoft-Konten und Themen mit Teams */
	teams?: boolean;
	quiet: QuietHours;
	absence: Absence | null;
}

async function insertRows(topic: string, rows: Row[], content: NotifyContent) {
	const now = new Date();
	const cache = new Map<string, Date | null>();
	const values = rows
		.filter((r) => r.bell || r.push || r.email || r.teams)
		.map((r) => ({
			personId: r.personId,
			topic,
			title: content.title.slice(0, 200),
			detail: content.detail?.slice(0, 200) ?? null,
			link: content.link,
			bell: r.bell,
			email: r.email ? ('pending' as const) : null,
			push: r.push ? ('pending' as const) : null,
			teams: r.teams ? ('pending' as const) : null,
			pushAfter: r.push || r.teams ? pushTiming(topic, r, now, cache) : null
		}));
	if (values.length) await db.insert(notifications).values(values);
	// Push nicht auf den minütlichen Lauf warten lassen
	if (values.some((v) => v.push && !v.pushAfter))
		void import('./push.ts')
			.then((m) => m.sendDuePushes())
			.catch((err) => console.error('Push fehlgeschlagen:', err));
	if (values.some((v) => v.teams && !v.pushAfter))
		void import('./teams.ts')
			.then((m) => m.sendDueTeams())
			.catch((err) => console.error('Teams fehlgeschlagen:', err));
	return values.length;
}

/** Benachrichtigt die Personen nach ihren Einstellungen für dieses Thema. */
export async function notify(topic: string, personIds: string[], content: NotifyContent) {
	if (!TOPICS.some((t) => t.key === topic) || personIds.length === 0) return 0;
	let count = 0;
	for (let i = 0; i < personIds.length; i += 1000) {
		const chunk = personIds.slice(i, i + 1000);
		const rows = await db
			.select({ id: persons.id, n: personPreferences.notify, oid: persons.entraOid })
			.from(persons)
			.leftJoin(personPreferences, eq(personPreferences.personId, persons.id))
			.where(and(inArray(persons.id, chunk), regularPerson));
		const teamsOn = await teamsActive();
		count += await insertRows(
			topic,
			rows.map((r) => {
				const s = resolveNotify(r.n);
				const c = s.topics[topic];
				return {
					personId: r.id,
					...c,
					teams: teamsOn && c.teams && Boolean(r.oid),
					quiet: s.quiet,
					absence: s.absence
				};
			}),
			content
		);
	}
	return count;
}

/** Mit festen Kanälen je Person (Hub-Abos aus „Meine Hubs“); Ruhezeiten und Abwesenheit gelten trotzdem. */
export async function notifyWithChannels(
	topic: string,
	list: { personId: string; bell: boolean; push: boolean; email: boolean }[],
	content: NotifyContent
) {
	const wanted = list.filter((r) => r.bell || r.push || r.email);
	for (let i = 0; i < wanted.length; i += 1000) {
		const chunk = wanted.slice(i, i + 1000);
		const rows = await db
			.select({ id: persons.id, n: personPreferences.notify })
			.from(persons)
			.leftJoin(personPreferences, eq(personPreferences.personId, persons.id))
			.where(
				and(
					inArray(
						persons.id,
						chunk.map((c) => c.personId)
					),
					regularPerson
				)
			);
		const einst = new Map(rows.map((r) => [r.id, resolveNotify(r.n)]));
		await insertRows(
			topic,
			chunk
				.filter((c) => einst.has(c.personId))
				.map((c) => ({
					...c,
					quiet: einst.get(c.personId)!.quiet,
					absence: einst.get(c.personId)!.absence
				})),
			content
		);
	}
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
			unitId: units.id,
			unitType: units.type,
			channel: news.channel,
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
		if (n.unitType === 'hub') {
			// Hub-Beiträge nur an Abonnierende, Kanäle aus „Meine Hubs“
			const { hubRecipients } = await import('./hubs.ts');
			await notifyWithChannels('hubs', await hubRecipients(n.unitId), {
				title: n.title,
				detail: n.unitName,
				link: `/neuigkeiten/${n.id}`
			});
			continue;
		}
		const topic =
			n.channel === 'kulissen'
				? 'kulissen'
				: urgent
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
			link: n.channel === 'kulissen' ? `/hinter-den-kulissen/${n.id}` : `/neuigkeiten/${n.id}`
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
			readAt: notifications.readAt,
			/** alle bzw. ungelesene ohne Grenze (lange Liste, Kap. 6.7) */
			gesamt: sql<number>`(count(*) over ())::int`,
			ungelesen: sql<number>`(count(*) filter (where ${notifications.readAt} is null) over ())::int`
		})
		.from(notifications)
		.where(and(eq(notifications.personId, personId), eq(notifications.bell, true)))
		.orderBy(desc(notifications.createdAt), desc(notifications.id))
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
			givenName: persons.givenName,
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
	const heute = berlinNow().date;
	for (const r of rows) {
		const einst = resolveNotify(r.pref);
		if (!modes.includes(einst.emailMode)) continue;
		// Abwesend: E-Mails warten und kommen danach gesammelt (Dringendes nach Wahl)
		if (isAbsent(heute, einst.absence) && !(r.topic === 'dringend' && einst.absence?.urgent))
			continue;
		const entry = byPerson.get(r.personId) ?? {
			email: r.email,
			name: vorname(r.name, r.givenName),
			items: []
		};
		entry.items.push({ id: r.nid, topic: r.topic, title: r.title, detail: r.detail, link: r.link });
		byPerson.set(r.personId, entry);
	}
	for (const { email, name, items } of byPerson.values()) {
		try {
			await sendMail({ to: email, ...mailFor(name, items, digest) });
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
	const days = await getRetention('notifications_days');
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
			await track('benachrichtigungen', async () => {
				await dispatchNews();
				await sendEmails();
				const { sendDuePushes } = await import('./push.ts');
				await sendDuePushes();
				const { sendDueTeams } = await import('./teams.ts');
				await sendDueTeams();
			});
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
