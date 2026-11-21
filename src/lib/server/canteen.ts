/**
 * Speiseplan und Standorte (Kap. 4.3, 8.7, 14, 15).
 * - Verwaltung (Mandanten-Admin): Standorte anlegen, Name/Adresse, Betreiber-Konten.
 * - Betreiber (lokales Konto, genau ein Standort): Speiseplan, Öffnungs- und
 *   Schließzeiten nur des eigenen Standorts. Kein Notfall-Upload durch die Verwaltung.
 * - Alle anderen: lesen; „Mein Standort“ im Konto.
 */
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
	berlinNow,
	checkClosure,
	checkHours,
	checkMenuDates,
	closureNotices,
	defaultHours,
	menuTitle,
	openState,
	type Closure,
	type OpeningDay
} from '../canteen.ts';
import { audit } from './audit.ts';
import { canAdministerTenant, type Principal } from './auth/access.ts';
import { inviteLocalPerson } from './auth/local.ts';
import { endAllSessions } from './auth/session.ts';
import { db } from './db/index.ts';
import {
	files,
	localCredentials,
	locationClosures,
	locationOperators,
	locations,
	menus,
	personLocations,
	persons,
	tenants
} from './db/schema.ts';
import { deleteStored, FileError, storePdf } from './files/store.ts';
import { notify } from './notify.ts';
import { administrableTenants } from './units.ts';

export class CanteenError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(v: string | null | undefined, max: number): string | null {
	const t = (v ?? '').trim().slice(0, max);
	return t ? t : null;
}

// ---------------------------------------------------------------------------
// Lesen für alle
// ---------------------------------------------------------------------------

/** Alle aktiven Standorte (für „Mein Standort“), mit Mandant. */
export async function allLocations() {
	return db
		.select({
			id: locations.id,
			name: locations.name,
			address: locations.address,
			tenantShort: tenants.shortName,
			tenantId: tenants.id
		})
		.from(locations)
		.innerJoin(tenants, eq(tenants.id, locations.tenantId))
		.where(eq(locations.active, true))
		.orderBy(asc(locations.name));
}

export async function myLocationIds(personId: string): Promise<string[]> {
	const rows = await db
		.select({ id: personLocations.locationId })
		.from(personLocations)
		.innerJoin(locations, eq(locations.id, personLocations.locationId))
		.where(and(eq(personLocations.personId, personId), eq(locations.active, true)))
		.orderBy(asc(locations.name));
	return rows.map((r) => r.id);
}

export async function setMyLocations(personId: string, ids: string[]) {
	const valid = (await allLocations()).map((l) => l.id);
	const wanted = [...new Set(ids)].filter((id) => valid.includes(id)).slice(0, 20);
	await db.transaction(async (tx) => {
		await tx.delete(personLocations).where(eq(personLocations.personId, personId));
		if (wanted.length)
			await tx
				.insert(personLocations)
				.values(wanted.map((locationId) => ({ personId, locationId })));
	});
}

async function closuresOf(locationId: string, today: string) {
	return db
		.select({
			id: locationClosures.id,
			fromDate: locationClosures.fromDate,
			untilDate: locationClosures.untilDate,
			reason: locationClosures.reason,
			announceDays: locationClosures.announceDays
		})
		.from(locationClosures)
		.where(and(eq(locationClosures.locationId, locationId), gte(locationClosures.untilDate, today)))
		.orderBy(asc(locationClosures.fromDate));
}

/** Alles, was Beschäftigte zu einem Standort sehen. */
export async function canteenView(locationId: string, now = new Date()) {
	if (!GUID.test(locationId)) return null;
	const [loc] = await db
		.select()
		.from(locations)
		.where(and(eq(locations.id, locationId), eq(locations.active, true)));
	if (!loc) return null;
	const n = berlinNow(now);
	const [closures, menuRows] = await Promise.all([
		closuresOf(loc.id, n.date),
		db
			.select({
				id: menus.id,
				validFrom: menus.validFrom,
				validUntil: menus.validUntil,
				fileId: menus.fileId,
				size: files.size,
				fileName: files.name
			})
			.from(menus)
			.innerJoin(files, eq(files.id, menus.fileId))
			.where(and(eq(menus.locationId, loc.id), gte(menus.validUntil, n.date)))
			.orderBy(asc(menus.validFrom))
	]);
	const notices = closureNotices(closures, n.date);
	const closedToday = loc.closedOn === n.date || notices.active !== null;
	const current =
		[...menuRows].reverse().find((m) => m.validFrom <= n.date && n.date <= m.validUntil) ?? null;
	const upcoming = menuRows.filter((m) => m.validFrom > n.date);
	const withTitle = <T extends { validFrom: string; validUntil: string }>(m: T) => ({
		...m,
		title: menuTitle(m.validFrom, m.validUntil)
	});
	return {
		id: loc.id,
		name: loc.name,
		address: loc.address,
		place: loc.place,
		note: loc.note,
		contact: loc.contact,
		hours: loc.hours,
		today: n.date,
		status: openState(loc.hours, n, closedToday),
		closedToday: loc.closedOn === n.date,
		activeClosure: notices.active,
		announced: notices.announced,
		current: current ? withTitle(current) : null,
		upcoming: upcoming.map(withTitle)
	};
}

/** Kurzfassung für die Startseite: eigene Standorte. */
export async function canteenCards(personId: string) {
	const ids = await myLocationIds(personId);
	const views = await Promise.all(ids.slice(0, 3).map((id) => canteenView(id)));
	return views.filter((v) => v !== null);
}

/**
 * Für den Download: Speisepläne sehen alle Angemeldeten, Betreiber nur die
 * ihres Standorts.
 */
export async function menuFileAllowed(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [m] = await db
		.select({ locationId: menus.locationId })
		.from(menus)
		.where(eq(menus.fileId, fileId));
	if (!m) return false;
	return !p.operatorLocationId || p.operatorLocationId === m.locationId;
}

// ---------------------------------------------------------------------------
// Verwaltung → Standorte
// ---------------------------------------------------------------------------

export async function listLocationsForAdmin(p: Principal) {
	const tenantIds = (await administrableTenants(p)).map((t) => t.id);
	if (tenantIds.length === 0) return [];
	return db
		.select({
			id: locations.id,
			name: locations.name,
			address: locations.address,
			active: locations.active,
			tenantName: tenants.name,
			operators: sql<number>`(select count(*)::int from location_operators lo where lo.location_id = ${locations.id})`
		})
		.from(locations)
		.innerJoin(tenants, eq(tenants.id, locations.tenantId))
		.where(inArray(locations.tenantId, tenantIds))
		.orderBy(asc(tenants.name), asc(locations.name));
}

async function loadForAdmin(p: Principal, id: string) {
	if (!GUID.test(id)) throw new CanteenError('Standort nicht gefunden.');
	const [loc] = await db.select().from(locations).where(eq(locations.id, id));
	if (!loc || !canAdministerTenant(p, loc.tenantId))
		throw new CanteenError('Standort nicht gefunden.');
	return loc;
}

export async function getLocationForAdmin(p: Principal, id: string) {
	const loc = await loadForAdmin(p, id);
	const operators = await db
		.select({
			id: persons.id,
			name: persons.displayName,
			email: persons.email,
			status: persons.status,
			lastLoginAt: persons.lastLoginAt
		})
		.from(locationOperators)
		.innerJoin(persons, eq(persons.id, locationOperators.personId))
		.where(eq(locationOperators.locationId, id))
		.orderBy(asc(persons.displayName));
	const [tenant] = await db
		.select({ name: tenants.name })
		.from(tenants)
		.where(eq(tenants.id, loc.tenantId));
	return { ...loc, tenantName: tenant?.name ?? '', operators };
}

export async function createLocation(
	p: Principal,
	input: { tenantId: string; name: string; address: string },
	ip: string
) {
	if (!GUID.test(input.tenantId) || !canAdministerTenant(p, input.tenantId))
		throw new CanteenError('Für diesen Mandanten darfst du keine Standorte anlegen.');
	const name = clean(input.name, 80);
	if (!name || name.length < 2) throw new CanteenError('Gib bitte einen Namen an.');
	const [row] = await db
		.insert(locations)
		.values({
			tenantId: input.tenantId,
			name,
			address: clean(input.address, 200),
			hours: defaultHours()
		})
		.returning({ id: locations.id });
	await audit({
		category: 'admin',
		action: 'location.create',
		actorId: p.personId,
		tenantId: input.tenantId,
		entityType: 'location',
		entityId: row.id,
		details: { name },
		ip
	});
	return row.id;
}

export async function updateLocation(
	p: Principal,
	id: string,
	input: { name: string; address: string; active: boolean },
	ip: string
) {
	const loc = await loadForAdmin(p, id);
	const name = clean(input.name, 80);
	if (!name || name.length < 2) throw new CanteenError('Gib bitte einen Namen an.');
	await db
		.update(locations)
		.set({ name, address: clean(input.address, 200), active: input.active })
		.where(eq(locations.id, id));
	// Deaktivieren sperrt auch die Betreiber-Konten aus
	if (!input.active && loc.active) {
		const ops = await db
			.select({ id: locationOperators.personId })
			.from(locationOperators)
			.where(eq(locationOperators.locationId, id));
		for (const o of ops) await endAllSessions(o.id);
	}
	await audit({
		category: 'admin',
		action: 'location.update',
		actorId: p.personId,
		tenantId: loc.tenantId,
		entityType: 'location',
		entityId: id,
		details: { name, active: input.active },
		ip
	});
}

export type OperatorInviteResult = { ok: true } | { ok: false; message: string };

/** Betreiber-Konto einladen (lokales Konto, Mandant des Standorts). */
export async function inviteOperator(
	p: Principal,
	locationId: string,
	input: { name: string; email: string },
	origin: string,
	ip: string
): Promise<OperatorInviteResult> {
	const loc = await loadForAdmin(p, locationId);
	const email = input.email.trim().slice(0, 320);
	const name = input.name.trim().slice(0, 200);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name)
		return { ok: false, message: 'Gib bitte Name und eine gültige E-Mail-Adresse ein.' };

	const [existing] = await db
		.select({ id: persons.id, operatorOf: locationOperators.locationId })
		.from(persons)
		.leftJoin(locationOperators, eq(locationOperators.personId, persons.id))
		.where(sql`lower(${persons.email}) = lower(${email})`);
	if (existing && existing.operatorOf !== locationId)
		return { ok: false, message: 'Für diese E-Mail-Adresse gibt es schon ein Konto.' };

	const result = await inviteLocalPerson({
		email,
		displayName: name,
		invitedBy: p.personId,
		origin,
		ip,
		tenantId: loc.tenantId,
		mayInvite: (tenantId) => canAdministerTenant(p, tenantId)
	});
	if (!result.ok) {
		const messages = {
			unknown_domain: 'Diese E-Mail-Domain ist keinem Mandanten zugeordnet.',
			forbidden: 'Du darfst nur Konten in deinem eigenen Mandanten anlegen.',
			exists: 'Für diese E-Mail-Adresse gibt es schon ein Konto.',
			mail_failed:
				'Das Konto ist angelegt, aber die E-Mail konnte nicht gesendet werden. Prüf den Absender und versuch es noch einmal.'
		} as const;
		// Auch bei fehlgeschlagener Mail ist das Konto angelegt: Standort zuordnen
		if (result.reason === 'mail_failed') await linkOperator(email, locationId);
		return { ok: false, message: messages[result.reason] };
	}
	await linkOperator(email, locationId);
	return { ok: true };
}

async function linkOperator(email: string, locationId: string) {
	const [person] = await db
		.select({ id: persons.id })
		.from(persons)
		.where(sql`lower(${persons.email}) = lower(${email})`);
	if (person)
		await db
			.insert(locationOperators)
			.values({ personId: person.id, locationId })
			.onConflictDoNothing();
}

/** Betreiber-Konto sperren oder wieder freigeben. */
export async function setOperatorActive(
	p: Principal,
	locationId: string,
	personId: string,
	active: boolean,
	ip: string
) {
	const loc = await loadForAdmin(p, locationId);
	if (!GUID.test(personId)) throw new CanteenError('Konto nicht gefunden.');
	const [op] = await db
		.select({ personId: locationOperators.personId })
		.from(locationOperators)
		.where(
			and(eq(locationOperators.personId, personId), eq(locationOperators.locationId, locationId))
		);
	if (!op) throw new CanteenError('Konto nicht gefunden.');
	if (active) {
		const [c] = await db
			.select({ hash: localCredentials.passwordHash })
			.from(localCredentials)
			.where(eq(localCredentials.personId, personId));
		await db
			.update(persons)
			.set({ status: c?.hash ? 'active' : 'invited', disabledAt: null })
			.where(eq(persons.id, personId));
	} else {
		await db
			.update(persons)
			.set({ status: 'disabled', disabledAt: new Date() })
			.where(eq(persons.id, personId));
		await endAllSessions(personId);
	}
	await audit({
		category: 'admin',
		action: active ? 'person.enable' : 'person.disable',
		actorId: p.personId,
		tenantId: loc.tenantId,
		entityType: 'person',
		entityId: personId,
		details: { betreiber: true },
		ip
	});
}

// ---------------------------------------------------------------------------
// Betreiber
// ---------------------------------------------------------------------------

async function operatorLocation(p: Principal) {
	if (!p.operatorLocationId) throw new CanteenError('Dafür fehlt dir das Recht.');
	const [loc] = await db.select().from(locations).where(eq(locations.id, p.operatorLocationId));
	if (!loc) throw new CanteenError('Dafür fehlt dir das Recht.');
	return loc;
}

/** Alles für die Betreiber-Oberfläche. */
export async function operatorOverview(p: Principal) {
	const loc = await operatorLocation(p);
	const today = berlinNow().date;
	const [menuRows, closures] = await Promise.all([
		db
			.select({
				id: menus.id,
				validFrom: menus.validFrom,
				validUntil: menus.validUntil,
				fileId: menus.fileId,
				size: files.size
			})
			.from(menus)
			.innerJoin(files, eq(files.id, menus.fileId))
			.where(and(eq(menus.locationId, loc.id), gte(menus.validUntil, today)))
			.orderBy(desc(menus.validFrom)),
		closuresOf(loc.id, today)
	]);
	return {
		location: {
			id: loc.id,
			name: loc.name,
			address: loc.address,
			active: loc.active,
			hours: loc.hours,
			place: loc.place ?? '',
			note: loc.note ?? '',
			contact: loc.contact ?? '',
			closedToday: loc.closedOn === today
		},
		today,
		menus: menuRows.map((m) => ({ ...m, title: menuTitle(m.validFrom, m.validUntil) })),
		closures
	};
}

export async function saveInfo(
	p: Principal,
	input: { hours: OpeningDay[]; place: string; note: string; contact: string }
) {
	const loc = await operatorLocation(p);
	const hours = input.hours.map((d) => ({
		open: Boolean(d.open),
		from: d.open ? String(d.from) : '',
		to: d.open ? String(d.to) : ''
	}));
	const err = checkHours(hours);
	if (err) throw new CanteenError(err);
	await db
		.update(locations)
		.set({
			hours,
			place: clean(input.place, 200),
			note: clean(input.note, 500),
			contact: clean(input.contact, 200)
		})
		.where(eq(locations.id, loc.id));
}

export async function setClosedToday(p: Principal, closed: boolean) {
	const loc = await operatorLocation(p);
	await db
		.update(locations)
		.set({ closedOn: closed ? berlinNow().date : null })
		.where(eq(locations.id, loc.id));
}

export async function saveClosure(p: Principal, id: string | null, input: Closure) {
	const loc = await operatorLocation(p);
	const today = berlinNow().date;
	const errors = checkClosure(input, today);
	if (Object.keys(errors).length) return { ok: false as const, errors };
	const values = {
		fromDate: input.fromDate,
		untilDate: input.untilDate,
		reason: clean(input.reason, 80),
		announceDays: input.announceDays
	};
	if (id) {
		if (!GUID.test(id)) throw new CanteenError('Schließzeit nicht gefunden.');
		const res = await db
			.update(locationClosures)
			.set(values)
			.where(and(eq(locationClosures.id, id), eq(locationClosures.locationId, loc.id)))
			.returning({ id: locationClosures.id });
		if (!res.length) throw new CanteenError('Schließzeit nicht gefunden.');
	} else {
		await db.insert(locationClosures).values({ ...values, locationId: loc.id });
	}
	return { ok: true as const };
}

export async function deleteClosure(p: Principal, id: string) {
	const loc = await operatorLocation(p);
	if (!GUID.test(id)) throw new CanteenError('Schließzeit nicht gefunden.');
	await db
		.delete(locationClosures)
		.where(and(eq(locationClosures.id, id), eq(locationClosures.locationId, loc.id)));
}

async function storeMenuPdf(p: Principal, file: File | null) {
	if (!file || file.size === 0) throw new CanteenError('Wähle bitte eine PDF-Datei aus.');
	try {
		return await storePdf(file, p.personId);
	} catch (err) {
		if (err instanceof FileError) throw new CanteenError(err.message);
		throw err;
	}
}

export async function uploadMenu(
	p: Principal,
	input: { validFrom: string; validUntil: string },
	file: File | null,
	ip: string
) {
	const loc = await operatorLocation(p);
	const errors = checkMenuDates(input.validFrom, input.validUntil, berlinNow().date);
	if (Object.keys(errors).length) throw new CanteenError(Object.values(errors)[0]);
	const stored = await storeMenuPdf(p, file);
	const [row] = await db
		.insert(menus)
		.values({
			locationId: loc.id,
			validFrom: input.validFrom,
			validUntil: input.validUntil,
			fileId: stored.id,
			uploadedBy: p.personId
		})
		.returning({ id: menus.id });
	await audit({
		category: 'admin',
		action: 'menu.upload',
		actorId: p.personId,
		tenantId: loc.tenantId,
		entityType: 'menu',
		entityId: row.id,
		details: { locationId: loc.id, validFrom: input.validFrom, validUntil: input.validUntil },
		ip
	});
	// Thema „Speiseplan (eigener Standort)“
	const readers = await db
		.select({ id: personLocations.personId })
		.from(personLocations)
		.where(eq(personLocations.locationId, loc.id));
	const title = menuTitle(input.validFrom, input.validUntil);
	await notify(
		'speiseplan',
		readers.map((r) => r.id),
		{ title, detail: loc.name, link: `/speiseplan?standort=${loc.id}&plan=${row.id}` }
	);
	return title;
}

/** Neue Datei für einen Speiseplan; die alte wird gelöscht. */
export async function replaceMenu(p: Principal, id: string, file: File | null, ip: string) {
	const loc = await operatorLocation(p);
	if (!GUID.test(id)) throw new CanteenError('Speiseplan nicht gefunden.');
	const [m] = await db
		.select()
		.from(menus)
		.where(and(eq(menus.id, id), eq(menus.locationId, loc.id)));
	if (!m) throw new CanteenError('Speiseplan nicht gefunden.');
	const stored = await storeMenuPdf(p, file);
	await db.update(menus).set({ fileId: stored.id, uploadedBy: p.personId }).where(eq(menus.id, id));
	await deleteStored([m.fileId]);
	await audit({
		category: 'admin',
		action: 'menu.upload',
		actorId: p.personId,
		tenantId: loc.tenantId,
		entityType: 'menu',
		entityId: id,
		details: { locationId: loc.id, neueFassung: true },
		ip
	});
	return menuTitle(m.validFrom, m.validUntil);
}

export async function deleteMenu(p: Principal, id: string, ip: string) {
	const loc = await operatorLocation(p);
	if (!GUID.test(id)) throw new CanteenError('Speiseplan nicht gefunden.');
	const [m] = await db
		.select()
		.from(menus)
		.where(and(eq(menus.id, id), eq(menus.locationId, loc.id)));
	if (!m) throw new CanteenError('Speiseplan nicht gefunden.');
	await db.delete(menus).where(eq(menus.id, id));
	await deleteStored([m.fileId]);
	await audit({
		category: 'admin',
		action: 'menu.delete',
		actorId: p.personId,
		tenantId: loc.tenantId,
		entityType: 'menu',
		entityId: id,
		details: { locationId: loc.id },
		ip
	});
	return menuTitle(m.validFrom, m.validUntil);
}

// ---------------------------------------------------------------------------
// Löschfristen (Kap. 15)
// ---------------------------------------------------------------------------

/** Speisepläne am Tag nach „Gültig bis“, vergangene Schließzeiten, alter „Heute geschlossen“. */
export async function deleteExpiredCanteenData(now = new Date()) {
	const today = berlinNow(now).date;
	const old = await db
		.select({ id: menus.id, fileId: menus.fileId })
		.from(menus)
		.where(lt(menus.validUntil, today));
	if (old.length) {
		await db.delete(menus).where(
			inArray(
				menus.id,
				old.map((o) => o.id)
			)
		);
		await deleteStored(old.map((o) => o.fileId));
	}
	await db.delete(locationClosures).where(lt(locationClosures.untilDate, today));
	await db.update(locations).set({ closedOn: null }).where(lt(locations.closedOn, today));
}
