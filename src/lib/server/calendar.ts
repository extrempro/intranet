/**
 * Kalender (Kap. 8.8, 15). Ausnahme von der Mandantentrennung (Grundprinzip 3):
 * Über „Aus: …“ lassen sich Termine weiterer Mandanten einblenden, daher
 * dürfen alle Angemeldeten jeden Termin öffnen. Anlegen nur mit dem Recht
 * „Termine“ und wenn die Einheit Termine haben darf (Regel/Ausnahme).
 */
import { and, asc, eq, exists, gte, ilike, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { addDays, berlinNow } from '../canteen.ts';
import { validateEvent, type EventErrors, type EventInput } from '../calendar.ts';
import { mayCreateEvents, unitTypeLabel } from '../roles.ts';
import { canWriteEvents, eventUnitIds, type Principal } from './auth/access.ts';
import { decryptSecret, encryptSecret, randomToken, sha256Hex } from './crypto.ts';
import { db } from './db/index.ts';
import {
	calendarFeeds,
	events,
	eventTenants,
	locationOperators,
	personPreferences,
	persons,
	tenants,
	units,
	type CalendarFeedConfig
} from './db/schema.ts';
import { getContentRules } from './rules.ts';
import { getSetting } from './settings.ts';

export class CalendarError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Platzhalter für „keine Auswahl“ in inArray */
const GUID_NONE = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Mandanten und „Aus: …“
// ---------------------------------------------------------------------------

export async function allTenants() {
	return db
		.select({ id: tenants.id, name: tenants.name, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
}

/** Weitere Mandanten aus „Aus: …“ (ohne den eigenen). */
export async function getCalendarTenants(p: Principal): Promise<string[]> {
	const [row] = await db
		.select({ t: personPreferences.calendarTenants })
		.from(personPreferences)
		.where(eq(personPreferences.personId, p.personId));
	return (row?.t ?? []).filter((id) => id !== p.tenantId);
}

export async function setCalendarTenants(p: Principal, ids: string[]) {
	const known = new Set((await allTenants()).map((t) => t.id));
	const list = [...new Set(ids)].filter((id) => known.has(id) && id !== p.tenantId);
	await db
		.insert(personPreferences)
		.values({ personId: p.personId, calendarTenants: list })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { calendarTenants: list } });
	return list;
}

/** Termin richtet sich an einen der Mandanten (wie bei Neuigkeiten). */
function forTenants(ids: string[]) {
	return or(
		eq(events.allTenants, true),
		inArray(events.tenantId, ids),
		exists(
			db
				.select({ x: sql`1` })
				.from(eventTenants)
				.where(and(eq(eventTenants.eventId, events.id), inArray(eventTenants.tenantId, ids)))
		)
	)!;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

const columns = {
	id: events.id,
	title: events.title,
	date: events.date,
	allDay: events.allDay,
	startTime: events.startTime,
	endTime: events.endTime,
	place: events.place,
	description: events.description,
	unitId: events.unitId,
	unitName: units.name,
	tenantId: events.tenantId,
	tenantShort: tenants.shortName,
	updatedAt: events.updatedAt
};

export interface ListOptions {
	from: string;
	to: string;
	tenantIds: string[];
	q?: string | null;
	unitIds?: string[] | null;
	limit?: number;
}

export async function listEvents(p: Principal, o: ListOptions) {
	const q = o.q?.trim().slice(0, 100);
	const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
	const rows = await db
		.select(columns)
		.from(events)
		.innerJoin(units, eq(units.id, events.unitId))
		.innerJoin(tenants, eq(tenants.id, events.tenantId))
		.where(
			and(
				gte(events.date, o.from),
				lte(events.date, o.to),
				forTenants([p.tenantId, ...o.tenantIds]),
				o.unitIds ? inArray(events.unitId, o.unitIds.length ? o.unitIds : [GUID_NONE]) : undefined,
				like
					? or(ilike(events.title, like), ilike(events.place, like), ilike(units.name, like))
					: undefined
			)
		)
		.orderBy(asc(events.date), sql`${events.allDay} desc`, asc(events.startTime), asc(events.title))
		.limit(Math.min(o.limit ?? 500, 1000));
	const writable = new Set((await eventWritableUnits(p)).map((u) => u.id));
	return rows.map((r) => ({
		...r,
		canEdit: writable.has(r.unitId),
		own: r.tenantId === p.tenantId
	}));
}

/** Ein Termin (alle Angemeldeten; Kalender ist mandantenübergreifend lesbar). */
export async function getEvent(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const [row] = await db
		.select(columns)
		.from(events)
		.innerJoin(units, eq(units.id, events.unitId))
		.innerJoin(tenants, eq(tenants.id, events.tenantId))
		.where(eq(events.id, id));
	if (!row) return null;
	const [targets, writable] = await Promise.all([
		db
			.select({ id: tenants.id, name: tenants.name })
			.from(eventTenants)
			.innerJoin(tenants, eq(tenants.id, eventTenants.tenantId))
			.where(eq(eventTenants.eventId, id)),
		eventWritableUnits(p)
	]);
	const [ev] = await db.select({ all: events.allTenants }).from(events).where(eq(events.id, id));
	return {
		...row,
		allTenants: ev.all,
		targets,
		canEdit: writable.some((u) => u.id === row.unitId)
	};
}

/** Startseite „Heute und morgen“. */
export async function todayAndTomorrow(p: Principal) {
	const today = berlinNow().date;
	const extra = await getCalendarTenants(p);
	return {
		today,
		items: await listEvents(p, {
			from: today,
			to: addDays(today, 1),
			tenantIds: extra,
			limit: 8
		})
	};
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export interface EventUnit {
	id: string;
	name: string;
	label: string;
	tenantId: string;
	isCentral: boolean;
}

/** Einheiten, für die die Person Termine anlegen darf. */
export async function eventWritableUnits(p: Principal): Promise<EventUnit[]> {
	const ids = [...eventUnitIds(p)];
	if (ids.length === 0) return [];
	const [rows, rules] = await Promise.all([
		db.select().from(units).where(inArray(units.id, ids)).orderBy(asc(units.name)),
		getContentRules()
	]);
	return rows
		.filter((u) => canWriteEvents(p, u) && mayCreateEvents(u, rules))
		.map((u) => ({
			id: u.id,
			name: u.name,
			label: unitTypeLabel(u),
			tenantId: u.tenantId,
			isCentral: u.isCentral
		}));
}

export interface SaveEventInput extends EventInput {
	unitId: string;
	allTenants: boolean;
	tenantIds: string[];
}

export async function saveEvent(
	p: Principal,
	id: string | null,
	input: SaveEventInput
): Promise<{ ok: true; id: string } | { ok: false; errors: EventErrors }> {
	const writable = await eventWritableUnits(p);
	if (id) {
		const [cur] = GUID.test(id)
			? await db.select({ unitId: events.unitId }).from(events).where(eq(events.id, id))
			: [];
		if (!cur || !writable.some((u) => u.id === cur.unitId))
			throw new CalendarError('Diesen Termin gibt es nicht oder du darfst ihn nicht ändern.');
	}
	const errors = validateEvent(input);
	const unit = writable.find((u) => u.id === input.unitId);
	if (!unit) errors.unitId = 'Für diese Einheit darfst du keine Termine anlegen.';
	// Zielgruppe: nicht-zentrale Einheiten nur für den eigenen Mandanten
	const known = new Set((await allTenants()).map((t) => t.id));
	const selected = [...new Set(input.tenantIds)].filter((t) => known.has(t));
	const central = unit?.isCentral ?? false;
	const all = central ? input.allTenants : false;
	if (central && !all && selected.length === 0)
		errors.targets = 'Wähl bitte mindestens einen Mandanten aus.';
	if (Object.keys(errors).length || !unit) return { ok: false, errors };

	const values = {
		unitId: unit.id,
		tenantId: unit.tenantId,
		title: input.title.trim(),
		date: input.date,
		allDay: input.allDay,
		startTime: input.allDay ? null : input.startTime,
		endTime: input.allDay || !input.endTime ? null : input.endTime,
		place: input.place.trim() || null,
		description: input.description.trim() || null,
		allTenants: all,
		updatedBy: p.personId
	};
	const eventId = await db.transaction(async (tx) => {
		let eid = id;
		if (eid) await tx.update(events).set(values).where(eq(events.id, eid));
		else
			eid = (
				await tx
					.insert(events)
					.values({ ...values, createdBy: p.personId })
					.returning({ id: events.id })
			)[0].id;
		await tx.delete(eventTenants).where(eq(eventTenants.eventId, eid));
		if (central && !all)
			await tx
				.insert(eventTenants)
				.values(selected.map((tenantId) => ({ eventId: eid!, tenantId })));
		return eid;
	});
	return { ok: true, id: eventId };
}

export async function deleteEvent(p: Principal, id: string) {
	const ev = await getEvent(p, id);
	if (!ev?.canEdit)
		throw new CalendarError('Diesen Termin gibt es nicht oder du darfst ihn nicht löschen.');
	await db.delete(events).where(eq(events.id, id));
}

// ---------------------------------------------------------------------------
// Persönliches iCal-Abo
// ---------------------------------------------------------------------------

export const DEFAULT_FEED: CalendarFeedConfig = { tenants: [], departments: 'all', unitIds: [] };

function feedUrl(origin: string, token: string) {
	return `${origin}/ical/${token}.ics`;
}

export async function getFeed(p: Principal, origin: string) {
	const [row] = await db.select().from(calendarFeeds).where(eq(calendarFeeds.personId, p.personId));
	if (!row) return { config: DEFAULT_FEED, url: null, revokedAt: null, lastFetchedAt: null };
	const active = !row.revokedAt;
	return {
		config: row.config,
		url: active ? feedUrl(origin, new TextDecoder().decode(decryptSecret(row.tokenEnc))) : null,
		revokedAt: row.revokedAt,
		lastFetchedAt: row.lastFetchedAt
	};
}

async function cleanConfig(p: Principal, c: CalendarFeedConfig): Promise<CalendarFeedConfig> {
	const known = new Set((await allTenants()).map((t) => t.id));
	const tenantIds = [...new Set(c.tenants)].filter((t) => known.has(t) && t !== p.tenantId);
	const unitIds =
		c.departments === 'selected'
			? [...new Set(c.unitIds)].filter((u) => GUID.test(u)).slice(0, 200)
			: [];
	const departments = ['all', 'selected', 'none'].includes(c.departments) ? c.departments : 'all';
	return { tenants: tenantIds, departments, unitIds };
}

function newToken() {
	const token = randomToken(32);
	return {
		tokenHash: sha256Hex(token),
		tokenEnc: encryptSecret(new TextEncoder().encode(token))
	};
}

/** Auswahl speichern; legt beim ersten Mal (oder nach Sperre) einen Link an. */
export async function saveFeed(p: Principal, config: CalendarFeedConfig) {
	const clean = await cleanConfig(p, config);
	const [row] = await db.select().from(calendarFeeds).where(eq(calendarFeeds.personId, p.personId));
	if (!row)
		await db.insert(calendarFeeds).values({ personId: p.personId, config: clean, ...newToken() });
	else if (row.revokedAt)
		await db
			.update(calendarFeeds)
			.set({
				config: clean,
				...newToken(),
				revokedAt: null,
				lastFetchedAt: null,
				createdAt: new Date()
			})
			.where(eq(calendarFeeds.personId, p.personId));
	else
		await db
			.update(calendarFeeds)
			.set({ config: clean })
			.where(eq(calendarFeeds.personId, p.personId));
}

/** Neuen Link erzeugen; der alte gilt sofort nicht mehr. */
export async function renewFeed(p: Principal) {
	const res = await db
		.update(calendarFeeds)
		.set({ ...newToken(), revokedAt: null, lastFetchedAt: null, createdAt: new Date() })
		.where(eq(calendarFeeds.personId, p.personId))
		.returning({ id: calendarFeeds.personId });
	if (!res.length) await saveFeed(p, DEFAULT_FEED);
}

export async function revokeFeed(p: Principal) {
	await db
		.update(calendarFeeds)
		.set({ revokedAt: new Date() })
		.where(and(eq(calendarFeeds.personId, p.personId), isNull(calendarFeeds.revokedAt)));
}

/** Einheiten (keine Hubs), die im Abo zur Auswahl stehen. */
export async function feedUnits(p: Principal, extraTenants: string[]) {
	const rows = await db
		.select({
			id: units.id,
			name: units.name,
			tenantId: units.tenantId,
			isCentral: units.isCentral,
			type: units.type
		})
		.from(units)
		.where(
			and(
				eq(units.hidden, false),
				sql`${units.type} <> 'hub'`,
				or(eq(units.isCentral, true), inArray(units.tenantId, [p.tenantId, ...extraTenants]))
			)
		)
		.orderBy(asc(units.name));
	return rows.map(({ id, name }) => ({ id, name }));
}

/**
 * Abruf des Abos ohne Anmeldung. Liefert die Termine (ohne Beschreibung)
 * oder null für unbekannte und gesperrte Links.
 */
export async function feedEvents(token: string) {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
	const [row] = await db
		.select({
			feed: calendarFeeds,
			tenantId: persons.tenantId,
			status: persons.status,
			operator: locationOperators.locationId
		})
		.from(calendarFeeds)
		.innerJoin(persons, eq(persons.id, calendarFeeds.personId))
		.leftJoin(locationOperators, eq(locationOperators.personId, calendarFeeds.personId))
		.where(eq(calendarFeeds.tokenHash, sha256Hex(token)));
	// Unbekannt, gesperrt, Konto gesperrt oder Betreiber-Konto: nichts
	if (!row || row.feed.revokedAt || row.status === 'disabled' || row.operator) return null;

	const now = new Date();
	if (!row.feed.lastFetchedAt || now.getTime() - row.feed.lastFetchedAt.getTime() > 3600_000)
		await db
			.update(calendarFeeds)
			.set({ lastFetchedAt: now })
			.where(eq(calendarFeeds.personId, row.feed.personId));

	const c = row.feed.config;
	if (c.departments === 'none') return [];
	const today = berlinNow(now).date;
	return db
		.select({
			id: events.id,
			title: events.title,
			date: events.date,
			allDay: events.allDay,
			startTime: events.startTime,
			endTime: events.endTime,
			place: events.place,
			sender: units.name,
			updatedAt: events.updatedAt
		})
		.from(events)
		.innerJoin(units, eq(units.id, events.unitId))
		.where(
			and(
				gte(events.date, addDays(today, -30)),
				lte(events.date, addDays(today, 365)),
				forTenants([row.tenantId, ...c.tenants]),
				c.departments === 'selected'
					? inArray(events.unitId, c.unitIds.length ? c.unitIds : [GUID_NONE])
					: undefined
			)
		)
		.orderBy(asc(events.date), asc(events.startTime))
		.limit(2000);
}

// ---------------------------------------------------------------------------
// Löschfristen (Kap. 15)
// ---------------------------------------------------------------------------

/** Vergangene Termine nach 3 Monaten (einstellbar), Abo-Links nach 12 Monaten ohne Abruf. */
export async function calendarRetention(now = new Date()) {
	const months = Math.max(1, Number(await getSetting('retention.events_months', 3)) || 3);
	await db
		.delete(events)
		.where(lt(events.date, sql`(current_date - make_interval(months => ${months}))::date`));
	await db
		.update(calendarFeeds)
		.set({ revokedAt: now })
		.where(
			and(
				isNull(calendarFeeds.revokedAt),
				lt(
					sql`coalesce(${calendarFeeds.lastFetchedAt}, ${calendarFeeds.createdAt})`,
					sql`now() - interval '12 months'`
				)
			)
		);
}
