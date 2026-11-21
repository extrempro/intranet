/**
 * Hinter den Kulissen (Kap. 8.4). Gespeichert wie Neuigkeiten (Kanal
 * „kulissen“), aber mandantenübergreifend: Schreibende wählen Ziel-Mandanten
 * (eigener immer), Lesende blenden über „Aus: …“ weitere ein. Daher wird hier
 * mit expliziter Prüfung gelesen statt über die Row-Level Security der
 * Neuigkeiten. Abgebildete Personen müssen zugestimmt haben.
 */
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { unitTypeLabel } from '../roles.ts';
import { audit } from './audit.ts';
import { canManageUnit, hasUnitRole, type Principal } from './auth/access.ts';
import { doc, headline, matches, rank } from './fts.ts';
import { db } from './db/index.ts';
import {
	files,
	news,
	newsAttachments,
	newsReactions,
	newsTenants,
	personPreferences,
	tenants,
	units
} from './db/schema.ts';
import { deleteStored, MAX_ATTACHMENTS, ownUnlinkedFiles } from './files/store.ts';
import { cleanHtml, excerpt, htmlToText } from './html.ts';
import { toggleReaction } from './news.ts';
import { getContentRules } from './rules.ts';
import { getSetting, setSetting } from './settings.ts';

export class KulissenError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE = ['jpeg', 'png', 'webp'];

export const DEFAULT_HOWTO =
	'Ihr möchtet zeigen, was bei euch hinter den Kulissen passiert? Die Abteilungsverwaltung schaltet „Hinter den Kulissen“ für die Abteilung frei und vergibt das Schreibrecht an einzelne Personen (Team → Rechte).';

export async function howTo(): Promise<string> {
	return getSetting('kulissen.so_gehts', DEFAULT_HOWTO);
}

export async function setHowTo(text: string, personId: string) {
	await setSetting('kulissen.so_gehts', text.trim().slice(0, 1000) || DEFAULT_HOWTO, personId);
}

// ---------------------------------------------------------------------------
// Rechte
// ---------------------------------------------------------------------------

export interface KulissenUnit {
	id: string;
	name: string;
	label: string;
	tenantId: string;
}

/** Einheiten, für die die Person schreiben darf: freigeschaltet und Schreibrecht. */
export async function writableUnits(p: Principal): Promise<KulissenUnit[]> {
	const ids = new Set<string>();
	for (const m of p.memberships) if (m.mayWriteBehindScenes) ids.add(m.unitId);
	for (const r of p.roles)
		if (r.role === 'abteilungsverwaltung' && r.scopeUnitId) ids.add(r.scopeUnitId);
	if (!ids.size) return [];
	const rows = await db
		.select()
		.from(units)
		.where(
			and(
				inArray(units.id, [...ids]),
				eq(units.behindScenes, true),
				sql`${units.type} <> 'hub'`,
				isNull(units.archivedAt)
			)
		)
		.orderBy(asc(units.name));
	return rows
		.filter(
			(u) =>
				p.memberships.some((m) => m.unitId === u.id && m.mayWriteBehindScenes) ||
				hasUnitRole(p, 'abteilungsverwaltung', u.id)
		)
		.map((u) => ({ id: u.id, name: u.name, label: unitTypeLabel(u), tenantId: u.tenantId }));
}

/** Einheiten, die die Person freischalten darf (Abteilungsverwaltung bzw. Redaktion ohne Pflege). */
export async function enableableUnits(p: Principal) {
	const ids = p.roles
		.filter((r) => r.role === 'abteilungsverwaltung' && r.scopeUnitId)
		.map((r) => r.scopeUnitId!);
	if (!ids.length) return [];
	const rows = await db
		.select()
		.from(units)
		.where(and(inArray(units.id, ids), sql`${units.type} <> 'hub'`, isNull(units.archivedAt)))
		.orderBy(asc(units.name));
	return rows
		.filter((u) => canManageUnit(p, u, true))
		.map((u) => ({ id: u.id, name: u.name, enabled: u.behindScenes }));
}

export async function setEnabled(p: Principal, unitId: string, enabled: boolean, ip: string) {
	const ok = (await enableableUnits(p)).find((u) => u.id === unitId);
	if (!ok) throw new KulissenError('Dafür fehlt dir das Recht.');
	await db.update(units).set({ behindScenes: enabled }).where(eq(units.id, unitId));
	await audit({
		category: 'admin',
		action: enabled ? 'unit.behind_scenes_on' : 'unit.behind_scenes_off',
		actorId: p.personId,
		entityType: 'unit',
		entityId: unitId,
		ip
	});
}

// ---------------------------------------------------------------------------
// „Aus: …“
// ---------------------------------------------------------------------------

export async function getExtraTenants(p: Principal): Promise<string[]> {
	const [row] = await db
		.select({ t: personPreferences.behindTenants })
		.from(personPreferences)
		.where(eq(personPreferences.personId, p.personId));
	return (row?.t ?? []).filter((id) => id !== p.tenantId);
}

export async function setExtraTenants(p: Principal, ids: string[]) {
	const known = new Set((await db.select({ id: tenants.id }).from(tenants)).map((t) => t.id));
	const list = [...new Set(ids)].filter((id) => known.has(id) && id !== p.tenantId);
	await db
		.insert(personPreferences)
		.values({ personId: p.personId, behindTenants: list })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { behindTenants: list } });
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

function visibleFor(tenantIds: string[]) {
	return and(
		eq(news.channel, 'kulissen'),
		lte(news.publishAt, sql`now()`),
		or(isNull(news.expiresAt), sql`${news.expiresAt} > now()`),
		isNull(units.archivedAt),
		sql`exists (select 1 from news_tenants nt where nt.news_id = ${news.id} and nt.tenant_id in ${tenantIds})`
	)!;
}

const columns = {
	id: news.id,
	title: news.title,
	bodyText: news.bodyText,
	publishAt: news.publishAt,
	unitId: news.unitId,
	unitName: units.name,
	unitSlug: units.slug,
	unitType: units.type,
	unitTitle: units.title,
	tenantId: news.tenantId,
	tenantShort: tenants.shortName
};

async function reactionsOf(p: Principal, ids: string[]) {
	if (!ids.length) return new Map<string, { emoji: string; n: number; mine: boolean }[]>();
	const [counts, mine, rules] = await Promise.all([
		db
			.select({
				id: newsReactions.newsId,
				emoji: newsReactions.emoji,
				n: sql<number>`count(*)::int`
			})
			.from(newsReactions)
			.where(inArray(newsReactions.newsId, ids))
			.groupBy(newsReactions.newsId, newsReactions.emoji),
		db
			.select({ id: newsReactions.newsId, emoji: newsReactions.emoji })
			.from(newsReactions)
			.where(and(inArray(newsReactions.newsId, ids), eq(newsReactions.personId, p.personId))),
		getContentRules()
	]);
	return new Map(
		ids.map((id) => [
			id,
			rules.reactions.map((emoji) => ({
				emoji,
				n: counts.find((c) => c.id === id && c.emoji === emoji)?.n ?? 0,
				mine: mine.some((m) => m.id === id && m.emoji === emoji)
			}))
		])
	);
}

async function imagesOf(ids: string[]) {
	if (!ids.length) return [];
	return db
		.select({
			newsId: newsAttachments.newsId,
			id: files.id,
			name: files.name,
			kind: files.kind,
			size: files.size
		})
		.from(newsAttachments)
		.innerJoin(files, eq(files.id, newsAttachments.fileId))
		.where(inArray(newsAttachments.newsId, ids))
		.orderBy(asc(newsAttachments.position));
}

export async function listPosts(p: Principal, q?: string | null) {
	const extra = await getExtraTenants(p);
	const term = q?.trim().slice(0, 100);
	const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
	const rows = await db
		.select(columns)
		.from(news)
		.innerJoin(units, eq(units.id, news.unitId))
		.innerJoin(tenants, eq(tenants.id, news.tenantId))
		.where(
			and(
				visibleFor([p.tenantId, ...extra]),
				like ? or(sql`${news.title} ilike ${like}`, sql`${news.bodyText} ilike ${like}`) : undefined
			)
		)
		.orderBy(desc(news.publishAt))
		.limit(60);
	const ids = rows.map((r) => r.id);
	const [att, reactions, writable] = await Promise.all([
		imagesOf(ids),
		reactionsOf(p, ids),
		writableUnits(p)
	]);
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		excerpt: excerpt(r.bodyText, 220),
		publishAt: r.publishAt,
		sender: r.unitName,
		senderLabel: unitTypeLabel({ type: r.unitType, title: r.unitTitle }),
		senderSlug: r.unitSlug,
		senderHub: r.unitType === 'hub',
		tenantShort: r.tenantShort,
		otherTenant: r.tenantId !== p.tenantId,
		cover: att.find((a) => a.newsId === r.id && IMAGE.includes(a.kind)) ?? null,
		images: att
			.filter((a) => a.newsId === r.id && IMAGE.includes(a.kind))
			.map((a) => ({ id: a.id })),
		reactions: reactions.get(r.id) ?? [],
		canEdit: writable.some((u) => u.id === r.unitId)
	}));
}

/** Ein Beitrag; sichtbar über eigenen Mandanten, „Aus: …“ oder eigenes Schreibrecht. */
export async function getPost(p: Principal, id: string) {
	if (!GUID.test(id)) return null;
	const extra = await getExtraTenants(p);
	const writable = await writableUnits(p);
	const [row] = await db
		.select({ ...columns, bodyHtml: news.bodyHtml })
		.from(news)
		.innerJoin(units, eq(units.id, news.unitId))
		.innerJoin(tenants, eq(tenants.id, news.tenantId))
		.where(
			and(
				eq(news.id, id),
				or(
					visibleFor([p.tenantId, ...extra]),
					and(
						eq(news.channel, 'kulissen'),
						writable.length
							? inArray(
									news.unitId,
									writable.map((u) => u.id)
								)
							: sql`false`
					)
				)
			)
		);
	if (!row) return null;
	const [att, reactions, targets] = await Promise.all([
		imagesOf([id]),
		reactionsOf(p, [id]),
		db
			.select({ id: tenants.id, name: tenants.name })
			.from(newsTenants)
			.innerJoin(tenants, eq(tenants.id, newsTenants.tenantId))
			.where(eq(newsTenants.newsId, id))
	]);
	return {
		...row,
		unitLabel: unitTypeLabel({ type: row.unitType, title: row.unitTitle }),
		images: att.filter((a) => IMAGE.includes(a.kind)),
		files: att.filter((a) => !IMAGE.includes(a.kind)),
		reactions: reactions.get(id) ?? [],
		targets,
		canEdit: writable.some((u) => u.id === row.unitId)
	};
}

export async function react(p: Principal, id: string, emoji: string) {
	if (!(await getPost(p, id))) throw new KulissenError('Beitrag nicht gefunden.');
	await toggleReaction(p, id, emoji);
}

/** Für den Download: Anhang eines sichtbaren Beitrags? */
export async function kulissenFileAllowed(p: Principal, fileId: string) {
	if (!GUID.test(fileId)) return false;
	const [link] = await db
		.select({ newsId: newsAttachments.newsId })
		.from(newsAttachments)
		.innerJoin(news, eq(news.id, newsAttachments.newsId))
		.where(and(eq(newsAttachments.fileId, fileId), eq(news.channel, 'kulissen')));
	return link ? Boolean(await getPost(p, link.newsId)) : false;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export interface PostInput {
	unitId: string;
	title: string;
	bodyHtml: string;
	tenantIds: string[];
	attachmentIds: string[];
	consent: boolean;
}

export type PostErrors = Partial<
	Record<'unitId' | 'title' | 'body' | 'attachments' | 'consent', string>
>;

export async function forEdit(p: Principal, id: string) {
	const post = await getPost(p, id);
	if (!post?.canEdit) return null;
	return post;
}

export async function savePost(
	p: Principal,
	id: string | null,
	input: PostInput
): Promise<{ ok: true; id: string } | { ok: false; errors: PostErrors }> {
	const writable = await writableUnits(p);
	const existing = id ? await forEdit(p, id) : null;
	if (id && !existing) throw new KulissenError('Beitrag nicht gefunden.');
	const errors: PostErrors = {};
	const unit = writable.find((u) => u.id === input.unitId);
	if (!unit) errors.unitId = 'Für diese Einheit darfst du hier nicht schreiben.';
	const title = input.title.trim();
	if (title.length < 3) errors.title = 'Gib bitte einen Titel an.';
	else if (title.length > 160) errors.title = 'Höchstens 160 Zeichen.';
	const bodyHtml = cleanHtml(input.bodyHtml);
	const bodyText = htmlToText(bodyHtml);
	if (!bodyText) errors.body = 'Erzähl bitte kurz, was zu sehen ist.';
	if (!input.consent)
		errors.consent = 'Bestätige bitte, dass alle abgebildeten Personen zugestimmt haben.';
	const wanted = [...new Set(input.attachmentIds.filter((x) => GUID.test(x)))];
	const current = existing ? [...existing.images, ...existing.files].map((a) => a.id) : [];
	if (wanted.length > MAX_ATTACHMENTS) errors.attachments = `Höchstens ${MAX_ATTACHMENTS} Dateien.`;
	const fresh = wanted.filter((x) => !current.includes(x));
	if (fresh.length && (await ownUnlinkedFiles(p.personId, fresh)).length !== fresh.length)
		errors.attachments = 'Eine Datei ist nicht mehr verfügbar. Lade sie bitte erneut hoch.';
	if (Object.keys(errors).length || !unit) return { ok: false, errors };

	const known = new Set((await db.select({ id: tenants.id }).from(tenants)).map((t) => t.id));
	const targets = [...new Set([unit.tenantId, ...input.tenantIds])].filter((t) => known.has(t));
	const removed = current.filter((x) => !wanted.includes(x));
	const postId = await db.transaction(async (tx) => {
		const values = {
			unitId: unit.id,
			tenantId: unit.tenantId,
			title,
			bodyHtml,
			bodyText,
			channel: 'kulissen' as const,
			allTenants: false,
			consentAt: new Date(),
			updatedBy: p.personId
		};
		let pid = id;
		if (pid) await tx.update(news).set(values).where(eq(news.id, pid));
		else
			pid = (
				await tx
					.insert(news)
					.values({ ...values, publishAt: new Date(), createdBy: p.personId })
					.returning({ id: news.id })
			)[0].id;
		await tx.delete(newsTenants).where(eq(newsTenants.newsId, pid));
		await tx.insert(newsTenants).values(targets.map((tenantId) => ({ newsId: pid!, tenantId })));
		await tx.delete(newsAttachments).where(eq(newsAttachments.newsId, pid));
		if (wanted.length)
			await tx
				.insert(newsAttachments)
				.values(wanted.map((fileId, position) => ({ newsId: pid!, fileId, position })));
		return pid;
	});
	await deleteStored(removed);
	return { ok: true, id: postId };
}

export async function deletePost(p: Principal, id: string) {
	const post = await forEdit(p, id);
	if (!post) throw new KulissenError('Beitrag nicht gefunden.');
	await db.delete(news).where(eq(news.id, id));
	await deleteStored([...post.images, ...post.files].map((a) => a.id));
}

/** Für die Verwaltung: „So geht’s“ bearbeiten dürfen alle System-Admins. */
export function mayEditHowTo(p: Principal) {
	return p.roles.some((r) => r.role === 'system_admin');
}

/** Angaben zu Dateien für das erneute Anzeigen des Formulars (eigene Uploads oder des Beitrags). */
export async function describeFiles(p: Principal, ids: string[], postId: string | null) {
	const valid = ids.filter((x) => GUID.test(x));
	if (!valid.length) return [];
	const post = postId ? await forEdit(p, postId) : null;
	const current = post ? [...post.images, ...post.files].map((a) => a.id) : [];
	const own = await ownUnlinkedFiles(
		p.personId,
		valid.filter((x) => !current.includes(x))
	);
	const allowed = valid.filter((x) => current.includes(x) || own.includes(x));
	if (!allowed.length) return [];
	const rows = await db
		.select({ id: files.id, name: files.name, size: files.size })
		.from(files)
		.where(inArray(files.id, allowed));
	return allowed.map((x) => rows.find((r) => r.id === x)!).filter(Boolean);
}

/** Globale Suche (Kap. 8.14): sichtbare Beiträge aus „Hinter den Kulissen“. */
export async function searchPosts(p: Principal, tsq: string, limit = 20) {
	const extra = await getExtraTenants(p);
	const document = doc(news.title, news.bodyText);
	return db
		.select({
			id: news.id,
			title: news.title,
			publishAt: news.publishAt,
			unitName: units.name,
			snippet: headline(news.bodyText, tsq)
		})
		.from(news)
		.innerJoin(units, eq(units.id, news.unitId))
		.where(and(visibleFor([p.tenantId, ...extra]), matches(document, tsq)))
		.orderBy(desc(rank(document, tsq)), desc(news.publishAt))
		.limit(limit);
}
