/**
 * Personen und Kontaktdaten (Kap. 8.13): Personenseite, eigene Kontaktdaten
 * und Profilfoto. Sichtbar ist eine Person im eigenen Mandanten oder als
 * Mitglied einer zentralen Einheit – geprüft per Row-Level Security.
 */
import { and, asc, eq, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import {
	mobileVisible,
	validateContact,
	type ContactErrors,
	type ContactInput
} from '../profile.ts';
import { unitTypeLabel } from '../roles.ts';
import { audit } from './audit.ts';
import type { Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import {
	boardAdPhotos,
	boardAds,
	locationOperators,
	locations,
	personLocations,
	persons,
	responsibilities,
	tenants,
	unitMembers,
	units
} from './db/schema.ts';
import { deleteStored, storeBytes } from './files/store.ts';
import { JpegError, stripJpeg } from './files/jpeg.ts';
import { getRetention } from './retention.ts';

export class ProfileError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sichtbare, aktive Person (keine Betreiber-Konten). */
async function visiblePerson(p: Principal, personId: string) {
	if (!GUID.test(personId)) return null;
	const [row] = await scoped(p, (tx) =>
		tx
			.select({ id: persons.id })
			.from(persons)
			.where(and(eq(persons.id, personId), ne(persons.status, 'disabled')))
	);
	if (!row) return null;
	const [op] = await db
		.select({ id: locationOperators.personId })
		.from(locationOperators)
		.where(eq(locationOperators.personId, personId));
	return op ? null : row;
}

/** Teilen zwei Personen eine Einheit (für „Nur mein Team“)? */
export async function sharesUnit(a: string, b: string): Promise<boolean> {
	if (a === b) return true;
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(unitMembers)
		.where(
			and(
				eq(unitMembers.personId, a),
				sql`exists (select 1 from unit_members o where o.unit_id = ${unitMembers.unitId} and o.person_id = ${b})`
			)
		);
	return (row?.n ?? 0) > 0;
}

export function photoUrl(person: { id: string; photoFileId: string | null }): string | null {
	return person.photoFileId
		? `/personen/${person.id}/foto?v=${person.photoFileId.slice(0, 8)}`
		: null;
}

export async function getPerson(p: Principal, personId: string) {
	if (!(await visiblePerson(p, personId))) return null;
	const [row] = await db
		.select({ person: persons, tenantName: tenants.name, tenantShort: tenants.shortName })
		.from(persons)
		.innerJoin(tenants, eq(tenants.id, persons.tenantId))
		.where(eq(persons.id, personId));
	if (!row) return null;
	const x = row.person;
	const self = x.id === p.personId;
	const showMobile =
		x.mobile && mobileVisible(x.mobileVisibility, self, await sharesUnit(p.personId, x.id));

	// Einheiten, die die betrachtende Person sehen darf
	const visibleUnit = and(
		isNull(units.archivedAt),
		or(eq(units.isCentral, true), eq(units.tenantId, p.tenantId))
	);
	const [einheiten, leitung, zust, standorte] = await Promise.all([
		db
			.select({
				id: units.id,
				slug: units.slug,
				name: units.name,
				type: units.type,
				title: units.title
			})
			.from(unitMembers)
			.innerJoin(units, eq(units.id, unitMembers.unitId))
			.where(and(eq(unitMembers.personId, x.id), visibleUnit, eq(units.hidden, false)))
			.orderBy(sql`${unitMembers.isPrimary} desc`, asc(units.name)),
		db
			.select({
				unitId: units.id,
				lead: units.leadPersonId,
				second: units.secondLeadPersonId,
				deputy: units.deputyPersonId
			})
			.from(units)
			.where(
				and(
					visibleUnit,
					or(
						eq(units.leadPersonId, x.id),
						eq(units.secondLeadPersonId, x.id),
						eq(units.deputyPersonId, x.id)
					)
				)
			),
		db
			.select({
				id: responsibilities.id,
				topic: responsibilities.topic,
				vertretung: sql<boolean>`${responsibilities.deputyId} = ${x.id}`,
				unitName: units.name,
				slug: units.slug
			})
			.from(responsibilities)
			.innerJoin(units, eq(units.id, responsibilities.unitId))
			.where(
				and(
					visibleUnit,
					or(eq(responsibilities.personId, x.id), eq(responsibilities.deputyId, x.id))
				)
			)
			.orderBy(asc(units.name), asc(responsibilities.position)),
		db
			.select({ name: locations.name })
			.from(personLocations)
			.innerJoin(locations, eq(locations.id, personLocations.locationId))
			.where(and(eq(personLocations.personId, x.id), eq(locations.active, true)))
			.orderBy(asc(locations.name))
	]);

	const rolle = (unitId: string) => {
		const l = leitung.find((r) => r.unitId === unitId);
		if (!l) return null;
		if (l.lead === x.id || l.second === x.id) return 'Leitung';
		return 'Stellvertretung';
	};
	return {
		id: x.id,
		name: x.displayName,
		email: x.email,
		position: x.position,
		phone: x.phone,
		mobile: showMobile ? x.mobile : null,
		room: x.room,
		foto: photoUrl(x),
		tenantName: row.tenantName,
		tenantShort: row.tenantShort,
		self,
		standorte: standorte.map((s) => s.name),
		einheiten: einheiten.map((u) => ({
			...u,
			label: unitTypeLabel(u),
			rolle: rolle(u.id),
			hatSeite: u.type !== 'hub'
		})),
		zustaendigkeiten: zust
	};
}

// ---------------------------------------------------------------------------
// Eigenes Profil
// ---------------------------------------------------------------------------

export async function getOwnProfile(p: Principal) {
	const [x] = await db.select().from(persons).where(eq(persons.id, p.personId));
	return {
		id: x.id,
		name: x.displayName,
		email: x.email,
		position: x.position ?? '',
		phone: x.phone ?? '',
		mobile: x.mobile ?? '',
		mobileVisibility: x.mobileVisibility,
		room: x.room ?? '',
		foto: photoUrl(x)
	};
}

export class ContactValidationError extends Error {
	constructor(public errors: ContactErrors) {
		super('Bitte prüfe die markierten Felder.');
	}
}

/** Kontaktdaten speichern – mit der App-Rolle, die nur die eigene Zeile ändern darf. */
export async function updateContact(p: Principal, input: ContactInput) {
	const { value, errors } = validateContact(input);
	if (!value) throw new ContactValidationError(errors);
	await scoped(p, (tx) =>
		tx
			.update(persons)
			.set({ ...value, updatedAt: new Date() })
			.where(eq(persons.id, p.personId))
	);
}

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Profilfoto speichern: Der Browser schneidet zu und liefert ein JPEG.
 * Hier wird es geprüft (quadratisch, 128–1024 px) und ohne Metadaten
 * verschlüsselt abgelegt. Ein altes Foto wird sofort gelöscht.
 */
export async function setPhoto(p: Principal, file: File) {
	if (!(file instanceof File) || file.size === 0) throw new ProfileError('Bitte wähle ein Foto.');
	if (file.size > PHOTO_MAX_BYTES) throw new ProfileError('Das Foto ist zu groß.');
	let clean;
	try {
		clean = stripJpeg(new Uint8Array(await file.arrayBuffer()));
	} catch (err) {
		if (err instanceof JpegError) throw new ProfileError('Das Foto konnte nicht gelesen werden.');
		throw err;
	}
	if (clean.width !== clean.height || clean.width < 128 || clean.width > 1024)
		throw new ProfileError('Das Foto muss quadratisch sein (128 bis 1024 Pixel).');
	const stored = await storeBytes(clean.data, 'profilfoto.jpg', 'jpeg', p.personId);
	const [old] = await db
		.select({ fileId: persons.photoFileId })
		.from(persons)
		.where(eq(persons.id, p.personId));
	await db.update(persons).set({ photoFileId: stored.id }).where(eq(persons.id, p.personId));
	if (old?.fileId) await deleteStored([old.fileId]);
}

/** Foto auf Wunsch löschen (Kap. 15: sofort). */
export async function removePhoto(personId: string) {
	const [old] = await db
		.select({ fileId: persons.photoFileId })
		.from(persons)
		.where(eq(persons.id, personId));
	if (!old?.fileId) return;
	await db.update(persons).set({ photoFileId: null }).where(eq(persons.id, personId));
	await deleteStored([old.fileId]);
}

/** Fotos gesperrter Konten löschen (Kap. 15: sofort bei Deaktivierung). */
export async function deletePhotosOfDisabled() {
	const rows = await db
		.select({ id: persons.id })
		.from(persons)
		.where(and(eq(persons.status, 'disabled'), isNotNull(persons.photoFileId)));
	for (const r of rows) await removePhoto(r.id);
}

/** Foto ausliefern, wenn die Person sichtbar ist. */
export async function photoFileFor(p: Principal, personId: string): Promise<string | null> {
	if (!(await visiblePerson(p, personId))) return null;
	const [row] = await db
		.select({ fileId: persons.photoFileId })
		.from(persons)
		.where(eq(persons.id, personId));
	return row?.fileId ?? null;
}

/** Fotos mehrerer Personen (für Listen); IDs müssen schon sichtbar sein. */
export async function photosOf(personIds: string[]): Promise<Map<string, string>> {
	if (personIds.length === 0) return new Map();
	const rows = await db
		.select({ id: persons.id, photoFileId: persons.photoFileId })
		.from(persons)
		.where(and(inArray(persons.id, personIds), isNotNull(persons.photoFileId)));
	return new Map(rows.map((r) => [r.id, photoUrl(r)!]));
}

/**
 * Personen suchen (Kap. 8.14): Name und Position, Präfix je Wort, dazu
 * Ähnlichkeit für Tippfehler im Namen. Sichtbarkeit per RLS.
 */
export async function searchPersons(p: Principal, q: string, tsq: string, limit = 20) {
	const document = sql`to_tsvector('intranet_simple', ${persons.displayName} || ' ' || coalesce(${persons.position}, ''))`;
	const query = sql`to_tsquery('intranet_simple', ${tsq})`;
	const plain = q.trim().slice(0, 60);
	const similar = sql`word_similarity(unaccent(lower(${plain})), unaccent(lower(${persons.displayName})))`;
	// Betreiber-Konten erscheinen nicht (die App-Rolle liest location_operators nicht)
	const operators = (
		await db.select({ id: locationOperators.personId }).from(locationOperators)
	).map((r) => r.id);
	const rows = await scoped(p, (tx) =>
		tx
			.select({
				id: persons.id,
				name: persons.displayName,
				position: persons.position,
				photoFileId: persons.photoFileId
			})
			.from(persons)
			.where(
				and(
					ne(persons.status, 'disabled'),
					operators.length ? notInArray(persons.id, operators) : undefined,
					or(sql`${document} @@ ${query}`, sql`${similar} > 0.55`)
				)
			)
			.orderBy(sql`(${document} @@ ${query}) desc`, sql`${similar} desc`, asc(persons.displayName))
			.limit(limit)
	);
	return rows.map(({ photoFileId, ...r }) => ({ ...r, foto: photoUrl({ id: r.id, photoFileId }) }));
}

/**
 * Deaktivierte Konten nach der Löschfrist löschen (Kap. 15). Beiträge, FAQs
 * und Termine gehören der Einheit und bleiben; Anzeigen am Schwarzen Brett,
 * Mitgliedschaften, Rollen, Abos, Benachrichtigungen und Reaktionen gehen mit.
 */
export async function deleteDisabledAccounts() {
	const days = await getRetention('disabled_accounts_days');
	const due = await db
		.select({ id: persons.id, tenantId: persons.tenantId })
		.from(persons)
		.where(
			and(
				eq(persons.status, 'disabled'),
				lt(persons.disabledAt, sql`now() - make_interval(days => ${days})`)
			)
		);
	for (const x of due) {
		const fotos = await db
			.select({ fileId: boardAdPhotos.fileId })
			.from(boardAdPhotos)
			.innerJoin(boardAds, eq(boardAds.id, boardAdPhotos.adId))
			.where(eq(boardAds.personId, x.id));
		await removePhoto(x.id);
		await db.delete(persons).where(eq(persons.id, x.id));
		await deleteStored(fotos.map((f) => f.fileId));
		await audit({
			category: 'admin',
			action: 'person.delete_retention',
			tenantId: x.tenantId,
			entityType: 'person',
			entityId: x.id,
			details: { nachTagen: days }
		});
	}
	return due.length;
}

/**
 * Personenliste unter Organisation: wie Suche und Personenseite nur der eigene
 * Mandant und Personen aus zentralen Einheiten (Row-Level Security), ohne
 * gesperrte und Betreiber-Konten. Filter nach Suchwort und Einheit.
 */
export async function listPeople(
	p: Principal,
	opts: { q?: string | null; unitId?: string | null; limit?: number }
) {
	const q = opts.q?.trim().slice(0, 100) ?? '';
	const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const unitId = opts.unitId && GUID.test(opts.unitId) ? opts.unitId : null;
	const limit = Math.min(opts.limit ?? 200, 500);
	// Einheiten, die die betrachtende Person sehen darf (ohne Hubs)
	const sichtbar = and(
		isNull(units.archivedAt),
		eq(units.hidden, false),
		ne(units.type, 'hub'),
		or(eq(units.isCentral, true), eq(units.tenantId, p.tenantId))
	);
	const betreiber = (
		await db.select({ id: locationOperators.personId }).from(locationOperators)
	).map((r) => r.id);
	const rows = await scoped(p, (tx) =>
		tx
			.select({
				id: persons.id,
				name: persons.displayName,
				email: persons.email,
				position: persons.position,
				phone: persons.phone,
				room: persons.room,
				photoFileId: persons.photoFileId
			})
			.from(persons)
			.where(
				and(
					ne(persons.status, 'disabled'),
					// Betreiber-Konten (die App-Rolle sieht location_operators nicht)
					betreiber.length ? notInArray(persons.id, betreiber) : undefined,
					unitId
						? sql`exists (select 1 from unit_members m where m.person_id = ${persons.id} and m.unit_id = ${unitId})`
						: undefined,
					q
						? or(
								sql`${persons.displayName} ilike ${like}`,
								sql`${persons.position} ilike ${like}`,
								sql`${persons.email} ilike ${like}`,
								sql`exists (select 1 from unit_members m join units u on u.id = m.unit_id where m.person_id = ${persons.id} and u.name ilike ${like})`
							)
						: undefined
				)
			)
			.orderBy(asc(persons.displayName))
			.limit(limit + 1)
	);
	const mehr = rows.length > limit;
	const liste = rows.slice(0, limit);
	const ids = liste.map((r) => r.id);
	const [mitglied, einheiten] = await Promise.all([
		ids.length
			? db
					.select({
						personId: unitMembers.personId,
						id: units.id,
						slug: units.slug,
						name: units.name
					})
					.from(unitMembers)
					.innerJoin(units, eq(units.id, unitMembers.unitId))
					.where(and(inArray(unitMembers.personId, ids), sichtbar))
					.orderBy(sql`${unitMembers.isPrimary} desc`, asc(units.name))
			: Promise.resolve([]),
		db
			.select({ id: units.id, name: units.name })
			.from(units)
			.where(sichtbar)
			.orderBy(asc(units.name))
	]);
	return {
		personen: liste.map((r) => ({
			id: r.id,
			name: r.name,
			email: r.email,
			position: r.position,
			phone: r.phone,
			room: r.room,
			foto: photoUrl({ id: r.id, photoFileId: r.photoFileId }),
			einheiten: mitglied
				.filter((m) => m.personId === r.id)
				.map(({ id, slug, name }) => ({ id, slug, name }))
		})),
		mehr,
		einheiten,
		q,
		unitId
	};
}
