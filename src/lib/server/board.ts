/**
 * Schwarzes Brett (Kap. 8.5). Mandantenübergreifend: Anzeigende wählen die
 * Ziel-Mandanten (eigener immer), Lesende blenden über „Anzeigen aus: …“
 * weitere ein. Neue Anzeigen erst nach Freigabe durch die Moderation des
 * Mandanten der anzeigenden Person. Kontakt immer über Nachrichten.
 */
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { hasTenantRole, type Principal } from './auth/access.ts';
import { doc, headline, matches, rank } from './fts.ts';
import { getRetention } from './retention.ts';
import { getContentRules } from './rules.ts';
import { db } from './db/index.ts';
import {
	boardAdPhotos,
	boardAdTenants,
	boardAds,
	boardCategories,
	boardReports,
	files,
	personPreferences,
	persons,
	tenants
} from './db/schema.ts';
import { deleteStored, ownUnlinkedFiles } from './files/store.ts';
import {
	closeByRef,
	findConversation,
	moderatorsOf,
	postAsRole,
	startConversation
} from './messages.ts';
import { notify, personsOfTenants } from './notify.ts';

export class BoardError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_DAYS = 30;
export const TITLE_MAX = 80;
export const BODY_MAX = 600;
export const PHOTOS_MAX = 3;
export const REPORT_REASONS = {
	gewerblich: 'Gewerblich',
	unpassend: 'Unpassender Inhalt',
	sonstiges: 'Sonstiges'
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

const days = (n: number) => new Date(Date.now() + n * 86400_000);

// ---------------------------------------------------------------------------
// Kategorien und „Anzeigen aus“
// ---------------------------------------------------------------------------

export async function categories() {
	return db
		.select({ id: boardCategories.id, name: boardCategories.name, fixed: boardCategories.fixed })
		.from(boardCategories)
		.orderBy(asc(boardCategories.position), asc(boardCategories.name));
}

export async function allTenantsList() {
	return db
		.select({ id: tenants.id, name: tenants.name, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
}

export async function getBoardTenants(p: Principal): Promise<string[]> {
	const [row] = await db
		.select({ t: personPreferences.boardTenants })
		.from(personPreferences)
		.where(eq(personPreferences.personId, p.personId));
	return (row?.t ?? []).filter((id) => id !== p.tenantId);
}

export async function setBoardTenants(p: Principal, ids: string[]) {
	const known = new Set((await allTenantsList()).map((t) => t.id));
	const list = [...new Set(ids)].filter((id) => known.has(id) && id !== p.tenantId);
	await db
		.insert(personPreferences)
		.values({ personId: p.personId, boardTenants: list })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { boardTenants: list } });
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

function targetedAt(ids: string[]) {
	return sql`exists (select 1 from board_ad_tenants t where t.ad_id = ${boardAds.id} and t.tenant_id in ${ids})`;
}

const adColumns = {
	id: boardAds.id,
	title: boardAds.title,
	body: boardAds.body,
	status: boardAds.status,
	categoryId: boardAds.categoryId,
	category: boardCategories.name,
	viaApps: boardAds.viaApps,
	ownContact: boardAds.ownContact,
	expiresAt: boardAds.expiresAt,
	extended: boardAds.extended,
	createdAt: boardAds.createdAt,
	rejectReason: boardAds.rejectReason,
	personId: boardAds.personId,
	author: persons.displayName,
	authorEmail: persons.email,
	tenantId: boardAds.tenantId,
	tenantShort: tenants.shortName,
	tenantName: tenants.name
};

async function photosOf(adIds: string[]) {
	if (!adIds.length) return new Map<string, { id: string; name: string }[]>();
	const rows = await db
		.select({ adId: boardAdPhotos.adId, id: files.id, name: files.name })
		.from(boardAdPhotos)
		.innerJoin(files, eq(files.id, boardAdPhotos.fileId))
		.where(inArray(boardAdPhotos.adId, adIds))
		.orderBy(asc(boardAdPhotos.position));
	const map = new Map<string, { id: string; name: string }[]>();
	for (const r of rows) map.set(r.adId, [...(map.get(r.adId) ?? []), { id: r.id, name: r.name }]);
	return map;
}

export async function listAds(p: Principal, o: { categoryId?: string | null; q?: string | null }) {
	const extra = await getBoardTenants(p);
	const q = o.q?.trim().slice(0, 100);
	const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
	const rows = await db
		.select(adColumns)
		.from(boardAds)
		.innerJoin(boardCategories, eq(boardCategories.id, boardAds.categoryId))
		.innerJoin(persons, eq(persons.id, boardAds.personId))
		.innerJoin(tenants, eq(tenants.id, boardAds.tenantId))
		.where(
			and(
				eq(boardAds.status, 'active'),
				targetedAt([p.tenantId, ...extra]),
				o.categoryId && GUID.test(o.categoryId) ? eq(boardAds.categoryId, o.categoryId) : undefined,
				like
					? or(sql`${boardAds.title} ilike ${like}`, sql`${boardAds.body} ilike ${like}`)
					: undefined
			)
		)
		.orderBy(desc(boardAds.createdAt))
		.limit(300);
	const photos = await photosOf(rows.map((r) => r.id));
	return rows.map((r) => ({
		...r,
		photos: photos.get(r.id) ?? [],
		mine: r.personId === p.personId,
		otherTenant: r.tenantId !== p.tenantId
	}));
}

/** Anzahl je Kategorie (für den Filter). */
export async function categoryCounts(p: Principal) {
	const extra = await getBoardTenants(p);
	const rows = await db
		.select({ id: boardAds.categoryId, n: sql<number>`count(*)::int` })
		.from(boardAds)
		.where(and(eq(boardAds.status, 'active'), targetedAt([p.tenantId, ...extra])))
		.groupBy(boardAds.categoryId);
	return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}

export async function myAds(p: Principal) {
	const rows = await db
		.select(adColumns)
		.from(boardAds)
		.innerJoin(boardCategories, eq(boardCategories.id, boardAds.categoryId))
		.innerJoin(persons, eq(persons.id, boardAds.personId))
		.innerJoin(tenants, eq(tenants.id, boardAds.tenantId))
		.where(eq(boardAds.personId, p.personId))
		.orderBy(desc(boardAds.createdAt));
	return rows;
}

async function maxActive() {
	return (await getContentRules()).boardMaxActive;
}

// ---------------------------------------------------------------------------
// Aufgeben, verlängern, erledigt, löschen
// ---------------------------------------------------------------------------

export interface AdInput {
	categoryId: string;
	title: string;
	body: string;
	viaApps: boolean;
	ownContact: string;
	tenantIds: string[];
	photoIds: string[];
}

export type AdErrors = Partial<
	Record<'categoryId' | 'title' | 'body' | 'ownContact' | 'photos' | 'limit', string>
>;

export async function createAd(
	p: Principal,
	input: AdInput
): Promise<{ ok: true } | { ok: false; errors: AdErrors }> {
	const errors: AdErrors = {};
	const cats = await categories();
	if (!cats.some((c) => c.id === input.categoryId))
		errors.categoryId = 'Wähl bitte eine Kategorie.';
	const title = input.title.trim();
	if (title.length < 3) errors.title = 'Gib bitte einen Titel an.';
	else if (title.length > TITLE_MAX) errors.title = `Höchstens ${TITLE_MAX} Zeichen.`;
	const body = input.body.trim();
	if (!body) errors.body = 'Beschreib bitte kurz, worum es geht.';
	else if (body.length > BODY_MAX) errors.body = `Höchstens ${BODY_MAX} Zeichen.`;
	const own = input.ownContact.trim();
	if (own.length > 80) errors.ownContact = 'Höchstens 80 Zeichen.';
	const photoIds = [...new Set(input.photoIds.filter((x) => GUID.test(x)))];
	if (photoIds.length > PHOTOS_MAX) errors.photos = `Höchstens ${PHOTOS_MAX} Fotos.`;
	else if (photoIds.length) {
		const ok = await ownUnlinkedFiles(p.personId, photoIds);
		const images = ok.length
			? await db
					.select({ id: files.id })
					.from(files)
					.where(and(inArray(files.id, ok), inArray(files.kind, ['jpeg', 'png', 'webp'])))
			: [];
		if (images.length !== photoIds.length)
			errors.photos =
				'Ein Foto ist nicht mehr verfügbar oder kein Bild. Lade es bitte erneut hoch.';
	}
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(boardAds)
		.where(and(eq(boardAds.personId, p.personId), inArray(boardAds.status, ['pending', 'active'])));
	const limit = await maxActive();
	if (n >= limit)
		errors.limit = `Du hast schon ${limit} aktive Anzeigen. Beende zuerst eine unter „Meine Anzeigen“.`;
	if (Object.keys(errors).length) return { ok: false, errors };

	const known = new Set((await allTenantsList()).map((t) => t.id));
	const targets = [...new Set([p.tenantId, ...input.tenantIds])].filter((t) => known.has(t));
	await db.transaction(async (tx) => {
		const [ad] = await tx
			.insert(boardAds)
			.values({
				personId: p.personId,
				tenantId: p.tenantId,
				categoryId: input.categoryId,
				title,
				body,
				viaApps: input.viaApps,
				ownContact: own || null,
				status: 'pending'
			})
			.returning({ id: boardAds.id });
		await tx.insert(boardAdTenants).values(targets.map((tenantId) => ({ adId: ad.id, tenantId })));
		if (photoIds.length)
			await tx
				.insert(boardAdPhotos)
				.values(photoIds.map((fileId, position) => ({ adId: ad.id, fileId, position })));
	});
	await notify('moderation', await moderatorsOf(p.tenantId), {
		title: `Neue Anzeige: ${title}`,
		detail: 'Schwarzes Brett prüfen',
		link: '/schwarzes-brett?ansicht=moderation'
	});
	return { ok: true };
}

async function ownAd(p: Principal, id: string) {
	if (!GUID.test(id)) throw new BoardError('Anzeige nicht gefunden.');
	const [ad] = await db
		.select()
		.from(boardAds)
		.where(and(eq(boardAds.id, id), eq(boardAds.personId, p.personId)));
	if (!ad) throw new BoardError('Anzeige nicht gefunden.');
	return ad;
}

/** Einmal um 30 Tage verlängern. */
export async function extendAd(p: Principal, id: string) {
	const ad = await ownAd(p, id);
	if (ad.status !== 'active' || ad.extended || !ad.expiresAt)
		throw new BoardError('Diese Anzeige lässt sich nicht verlängern.');
	await db
		.update(boardAds)
		.set({ extended: true, expiresAt: new Date(ad.expiresAt.getTime() + RUN_DAYS * 86400_000) })
		.where(eq(boardAds.id, id));
}

export async function markDone(p: Principal, id: string) {
	const ad = await ownAd(p, id);
	if (ad.status !== 'active' && ad.status !== 'pending')
		throw new BoardError('Diese Anzeige ist schon beendet.');
	await db.update(boardAds).set({ status: 'done', endedAt: new Date() }).where(eq(boardAds.id, id));
	await closeByRef(id);
}

export async function deleteAd(p: Principal, id: string) {
	await ownAd(p, id);
	await removeCompletely(id);
}

async function removeCompletely(id: string) {
	const photos = await db
		.select({ id: boardAdPhotos.fileId })
		.from(boardAdPhotos)
		.where(eq(boardAdPhotos.adId, id));
	await closeByRef(id);
	await db.delete(boardAds).where(eq(boardAds.id, id));
	await deleteStored(photos.map((x) => x.id));
}

// ---------------------------------------------------------------------------
// Kontakt und Melden
// ---------------------------------------------------------------------------

async function visibleAd(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const extra = await getBoardTenants(p);
	const [ad] = await db
		.select()
		.from(boardAds)
		.where(
			and(eq(boardAds.id, id), eq(boardAds.status, 'active'), targetedAt([p.tenantId, ...extra]))
		);
	return ad ?? null;
}

/** Gespräch mit der anzeigenden Person öffnen (oder das bestehende). */
export async function contactAuthor(p: Principal, id: string): Promise<string> {
	const ad = await visibleAd(p, id);
	if (!ad) throw new BoardError('Diese Anzeige gibt es nicht mehr.');
	if (ad.personId === p.personId) throw new BoardError('Das ist deine eigene Anzeige.');
	const existing = await findConversation('anzeige', id, p.personId);
	if (existing && !existing.closedAt) return existing.id;
	return startConversation({
		kind: 'anzeige',
		subject: ad.title,
		refId: id,
		memberIds: [p.personId, ad.personId]
	});
}

export async function reportAd(p: Principal, id: string, reason: string) {
	const ad = await visibleAd(p, id);
	if (!ad) throw new BoardError('Diese Anzeige gibt es nicht mehr.');
	if (ad.personId === p.personId) throw new BoardError('Das ist deine eigene Anzeige.');
	if (!(reason in REPORT_REASONS)) throw new BoardError('Wähl bitte einen Grund.');
	const inserted = await db
		.insert(boardReports)
		.values({ adId: id, reporterId: p.personId, reason: reason as ReportReason })
		.onConflictDoNothing()
		.returning({ id: boardReports.id });
	if (inserted.length)
		await notify('moderation', await moderatorsOf(ad.tenantId), {
			title: `Gemeldet: ${ad.title}`,
			detail: REPORT_REASONS[reason as ReportReason],
			link: '/schwarzes-brett?ansicht=moderation'
		});
}

// ---------------------------------------------------------------------------
// Moderation (je Mandant)
// ---------------------------------------------------------------------------

function moderates(p: Principal, tenantId: string) {
	return hasTenantRole(p, 'moderation_schwarzes_brett', tenantId);
}

export function isModerator(p: Principal) {
	return p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
}

/** Neue und gemeldete Anzeigen der Mandanten, die die Person moderiert. */
export async function moderationQueue(p: Principal) {
	const tenantIds = (await allTenantsList()).filter((t) => moderates(p, t.id)).map((t) => t.id);
	if (!tenantIds.length) return [];
	const rows = await db
		.select({
			...adColumns,
			reports: sql<
				string[]
			>`(select coalesce(array_agg(r.reason order by r.created_at), '{}') from board_reports r where r.ad_id = ${boardAds.id} and r.resolved_at is null)`
		})
		.from(boardAds)
		.innerJoin(boardCategories, eq(boardCategories.id, boardAds.categoryId))
		.innerJoin(persons, eq(persons.id, boardAds.personId))
		.innerJoin(tenants, eq(tenants.id, boardAds.tenantId))
		.where(
			and(
				inArray(boardAds.tenantId, tenantIds),
				or(
					eq(boardAds.status, 'pending'),
					and(
						eq(boardAds.status, 'active'),
						sql`exists (select 1 from board_reports r where r.ad_id = ${boardAds.id} and r.resolved_at is null)`
					)
				)
			)
		)
		.orderBy(asc(boardAds.createdAt));
	const photos = await photosOf(rows.map((r) => r.id));
	return rows.map((r) => ({ ...r, photos: photos.get(r.id) ?? [] }));
}

async function moderatedAd(p: Principal, id: string) {
	if (!GUID.test(id)) throw new BoardError('Anzeige nicht gefunden.');
	const [ad] = await db.select().from(boardAds).where(eq(boardAds.id, id));
	if (!ad || !moderates(p, ad.tenantId)) throw new BoardError('Anzeige nicht gefunden.');
	return ad;
}

export async function approveAd(p: Principal, id: string) {
	const ad = await moderatedAd(p, id);
	if (ad.status !== 'pending') throw new BoardError('Die Anzeige wurde schon bearbeitet.');
	await db
		.update(boardAds)
		.set({ status: 'active', expiresAt: days(RUN_DAYS) })
		.where(eq(boardAds.id, id));
	await notify('nachrichten', [ad.personId], {
		title: `Deine Anzeige ist online: ${ad.title}`,
		detail: 'Schwarzes Brett',
		link: '/schwarzes-brett?ansicht=meine'
	});
	const targets = (
		await db
			.select({ id: boardAdTenants.tenantId })
			.from(boardAdTenants)
			.where(eq(boardAdTenants.adId, id))
	).map((t) => t.id);
	const readers = (await personsOfTenants(targets)).filter((x) => x !== ad.personId);
	await notify('schwarzes_brett', readers, {
		title: ad.title,
		detail: 'Neue Anzeige',
		link: '/schwarzes-brett'
	});
}

/** Moderations-Gespräch mit der anzeigenden Person (Rückfrage, Begründung). */
async function moderationConversation(ad: {
	id: string;
	title: string;
	personId: string;
	tenantId: string;
}) {
	const existing = await findConversation('moderation', ad.id);
	if (existing && !existing.closedAt) return existing.id;
	return startConversation({
		kind: 'moderation',
		subject: ad.title,
		refId: ad.id,
		memberIds: [ad.personId],
		roleBox: 'moderation',
		roleTenantId: ad.tenantId
	});
}

export async function askAuthor(p: Principal, id: string) {
	const ad = await moderatedAd(p, id);
	return moderationConversation(ad);
}

/** Ablehnen (neu) bzw. entfernen (gemeldet), immer mit Begründung für die Person. */
export async function rejectAd(p: Principal, id: string, reason: string) {
	const ad = await moderatedAd(p, id);
	const text = reason.trim().slice(0, 500);
	if (!text) throw new BoardError('Gib bitte eine Begründung für die Person an.');
	if (ad.status !== 'pending' && ad.status !== 'active')
		throw new BoardError('Die Anzeige wurde schon bearbeitet.');
	const status = ad.status === 'pending' ? 'rejected' : 'removed';
	await db
		.update(boardAds)
		.set({ status, rejectReason: text, endedAt: new Date() })
		.where(eq(boardAds.id, id));
	await db
		.update(boardReports)
		.set({ resolvedAt: new Date() })
		.where(and(eq(boardReports.adId, id), isNull(boardReports.resolvedAt)));
	// Begründung im Moderations-Gespräch, danach alle Gespräche zur Anzeige schließen
	const conv = await moderationConversation(ad);
	await postAsRole(
		conv,
		p.personId,
		`${status === 'rejected' ? 'Deine Anzeige wurde nicht freigegeben' : 'Deine Anzeige wurde entfernt'}: ${text}`
	);
	await closeByRef(id);
	await notify('nachrichten', [ad.personId], {
		title: `${status === 'rejected' ? 'Nicht freigegeben' : 'Entfernt'}: ${ad.title}`,
		detail: 'Moderation',
		link: `/nachrichten/${conv}`
	});
}

/** Meldungen zurückweisen: Anzeige bleibt. */
export async function dismissReports(p: Principal, id: string) {
	await moderatedAd(p, id);
	await db
		.update(boardReports)
		.set({ resolvedAt: new Date() })
		.where(and(eq(boardReports.adId, id), isNull(boardReports.resolvedAt)));
}

// ---------------------------------------------------------------------------
// Fotos, Fristen
// ---------------------------------------------------------------------------

/** Für den Download: Foto einer sichtbaren, eigenen oder zu moderierenden Anzeige. */
export async function boardPhotoAllowed(p: Principal, fileId: string): Promise<boolean> {
	if (!GUID.test(fileId)) return false;
	const [row] = await db
		.select({ adId: boardAdPhotos.adId, personId: boardAds.personId, tenantId: boardAds.tenantId })
		.from(boardAdPhotos)
		.innerJoin(boardAds, eq(boardAds.id, boardAdPhotos.adId))
		.where(eq(boardAdPhotos.fileId, fileId));
	if (!row) return false;
	if (row.personId === p.personId || moderates(p, row.tenantId)) return true;
	return Boolean(await visibleAd(p, row.adId));
}

/** Abgelaufene beenden; beendete nach 30 Tagen löschen (Kap. 15). */
export async function boardRetention() {
	const expired = await db
		.update(boardAds)
		.set({ status: 'expired', endedAt: new Date() })
		.where(and(eq(boardAds.status, 'active'), lt(boardAds.expiresAt, new Date())))
		.returning({ id: boardAds.id });
	for (const e of expired) await closeByRef(e.id);
	const keep = await getRetention('board_days');
	const old = await db
		.select({ id: boardAds.id })
		.from(boardAds)
		.where(lt(boardAds.endedAt, sql`now() - make_interval(days => ${keep})`));
	for (const o of old) await removeCompletely(o.id);
}

// ---------------------------------------------------------------------------
// Verwaltung: Kategorien
// ---------------------------------------------------------------------------

export async function addCategory(name: string) {
	const n = name.trim().slice(0, 40);
	if (n.length < 2) throw new BoardError('Gib bitte einen Namen an.');
	const [{ max }] = await db
		.select({
			max: sql<number>`coalesce(max(${boardCategories.position}) filter (where not ${boardCategories.fixed}), -1)::int`
		})
		.from(boardCategories);
	await db
		.insert(boardCategories)
		.values({ name: n, position: max + 1 })
		.onConflictDoNothing();
}

export async function renameCategory(id: string, name: string) {
	const n = name.trim().slice(0, 40);
	if (!GUID.test(id) || n.length < 2) throw new BoardError('Gib bitte einen Namen an.');
	await db
		.update(boardCategories)
		.set({ name: n })
		.where(and(eq(boardCategories.id, id), eq(boardCategories.fixed, false)));
}

/** Löschen: Anzeigen wandern nach „Sonstiges“. */
export async function deleteCategory(id: string) {
	if (!GUID.test(id)) return;
	const [other] = await db.select().from(boardCategories).where(eq(boardCategories.fixed, true));
	const [cat] = await db.select().from(boardCategories).where(eq(boardCategories.id, id));
	if (!cat || cat.fixed || !other) throw new BoardError('„Sonstiges“ lässt sich nicht löschen.');
	await db.update(boardAds).set({ categoryId: other.id }).where(eq(boardAds.categoryId, id));
	await db.delete(boardCategories).where(eq(boardCategories.id, id));
}

export async function moveCategory(id: string, delta: -1 | 1) {
	const list = (await categories()).filter((c) => !c.fixed);
	const i = list.findIndex((c) => c.id === id);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j], list[i]];
	for (const [position, c] of list.entries())
		await db.update(boardCategories).set({ position }).where(eq(boardCategories.id, c.id));
}

/** Globale Suche (Kap. 8.14): aktive Anzeigen für den eigenen und die gewählten Mandanten. */
export async function searchAds(p: Principal, tsq: string, limit = 20) {
	const extra = await getBoardTenants(p);
	const document = doc(boardAds.title, boardAds.body);
	return db
		.select({
			id: boardAds.id,
			title: boardAds.title,
			category: boardCategories.name,
			createdAt: boardAds.createdAt,
			snippet: headline(boardAds.body, tsq)
		})
		.from(boardAds)
		.innerJoin(boardCategories, eq(boardCategories.id, boardAds.categoryId))
		.where(
			and(eq(boardAds.status, 'active'), targetedAt([p.tenantId, ...extra]), matches(document, tsq))
		)
		.orderBy(desc(rank(document, tsq)), desc(boardAds.createdAt))
		.limit(limit);
}
