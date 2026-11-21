/**
 * Neuigkeiten (Kap. 8.1, 8.2).
 *
 * Lesen läuft über scoped(): Row-Level Security trennt die Mandanten, die
 * Abfragen prüfen Zielgruppe, Freigabe und Ablauf zusätzlich. Schreiben
 * prüft das Recht im Code (canWriteNews) und läuft mit der Besitzer-Rolle.
 */
import {
	and,
	asc,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	isNull,
	lte,
	ne,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import {
	effectiveTargets,
	newsState,
	validateNews,
	type NewsDraft,
	type NewsErrors
} from '../news.ts';
import { mayPostUrgent, unitTypeLabel } from '../roles.ts';
import { audit } from './audit.ts';
import { canWriteNews, isEditorial, newsUnitIds, type Principal } from './auth/access.ts';
import { db, scoped } from './db/index.ts';
import {
	files,
	news,
	newsAttachments,
	newsReactions,
	newsTenants,
	tenants,
	units,
	urgentDismissals
} from './db/schema.ts';
import { beschreibungenSpeichern } from './files/beschreibung.ts';
import { deleteStored, MAX_ATTACHMENTS, ownUnlinkedFiles } from './files/store.ts';
import { cleanHtml, excerpt, htmlToText } from './html.ts';
import { doc, headline, matches, rank } from './fts.ts';
import { getContentRules } from './rules.ts';

export class NewsError extends Error {}

// ---------------------------------------------------------------------------
// Absender
// ---------------------------------------------------------------------------

export interface SenderUnit {
	id: string;
	name: string;
	label: string;
	tenantId: string;
	isCentral: boolean;
	mayUrgent: boolean;
	/** Hub: Beiträge erscheinen unter „Aus den Hubs“, ohne Anheften und Dringend */
	isHub: boolean;
}

/** Einheiten, für die die Person schreiben darf (Kap. 5.2). */
export async function writableUnits(p: Principal): Promise<SenderUnit[]> {
	const ids = [...newsUnitIds(p)];
	if (ids.length === 0) return [];
	const rows = await db
		.select({ unit: units, kbbUnitId: tenants.kbbUnitId })
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(inArray(units.id, ids))
		.orderBy(asc(units.name));
	return (
		rows
			.filter((r) => canWriteNews(p, r.unit))
			// Ruhende und archivierte Hubs schreiben nicht (Kap. 8.12)
			.filter((r) => !r.unit.archivedAt && !(r.unit.type === 'hub' && r.unit.restingSince))
			.map((r) => ({
				id: r.unit.id,
				name: r.unit.name,
				label: unitTypeLabel(r.unit),
				tenantId: r.unit.tenantId,
				isCentral: r.unit.isCentral,
				mayUrgent:
					r.unit.type !== 'hub' && mayPostUrgent({ ...r.unit, isKbb: r.kbbUnitId === r.unit.id }),
				isHub: r.unit.type === 'hub'
			}))
	);
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export type NewsFilter = 'alle' | 'meine' | 'geplant';

export interface ListOptions {
	filter?: NewsFilter;
	from?: string | null;
	q?: string | null;
	limit?: number;
	/** Neuigkeiten ohne Hubs (Standard), nur Hubs oder bestimmte Einheiten */
	hubs?: 'exclude' | 'only';
	unitIds?: string[];
}

/** Sichtbar für Lesende: Zielgruppe passt, freigegeben, nicht abgelaufen. */
function readerVisible(p: Principal, writable: string[], editorial: boolean, now: Date): SQL {
	const targeted = or(
		eq(news.allTenants, true),
		sql`exists (select 1 from news_tenants nt where nt.news_id = ${news.id} and nt.tenant_id = ${p.tenantId})`
	)!;
	const own = writable.length ? inArray(news.unitId, writable) : sql`false`;
	const published = lte(news.publishAt, now);
	// Geplante sehen nur Schreibende der Einheit und die Redaktion (Kap. 8.1)
	const plannedOk = editorial ? sql`true` : own;
	return and(
		or(targeted, own),
		or(published, plannedOk),
		or(isNull(news.expiresAt), gt(news.expiresAt, now))
	)!;
}

const columns = {
	id: news.id,
	unitId: news.unitId,
	title: news.title,
	bodyText: news.bodyText,
	publishAt: news.publishAt,
	expiresAt: news.expiresAt,
	pinnedUntil: news.pinnedUntil,
	urgentUntil: news.urgentUntil,
	urgentText: news.urgentText,
	allTenants: news.allTenants,
	unitName: units.name,
	unitSlug: units.slug,
	unitType: units.type,
	unitTitle: units.title,
	unitTenantId: units.tenantId,
	unitIsCentral: units.isCentral
};

type Row = {
	id: string;
	unitId: string;
	title: string;
	bodyText: string;
	publishAt: Date;
	expiresAt: Date | null;
	pinnedUntil: Date | null;
	urgentUntil: Date | null;
	urgentText: string | null;
	allTenants: boolean;
	unitName: string;
	unitSlug: string;
	unitType: 'geschaeftsfuehrung' | 'stabsstelle' | 'abteilung' | 'hub';
	unitTitle: string | null;
	unitTenantId: string;
	unitIsCentral: boolean;
};

async function decorate(p: Principal, rows: Row[], now: Date) {
	if (rows.length === 0) return [];
	const ids = rows.map((r) => r.id);
	const [targets, counts, mine, rules, attachmentCounts] = await Promise.all([
		db
			.select({ newsId: newsTenants.newsId, name: tenants.name })
			.from(newsTenants)
			.innerJoin(tenants, eq(tenants.id, newsTenants.tenantId))
			.where(inArray(newsTenants.newsId, ids)),
		db
			.select({
				newsId: newsReactions.newsId,
				emoji: newsReactions.emoji,
				n: sql<number>`count(*)::int`
			})
			.from(newsReactions)
			.where(inArray(newsReactions.newsId, ids))
			.groupBy(newsReactions.newsId, newsReactions.emoji),
		db
			.select({ newsId: newsReactions.newsId, emoji: newsReactions.emoji })
			.from(newsReactions)
			.where(and(inArray(newsReactions.newsId, ids), eq(newsReactions.personId, p.personId))),
		getContentRules(),
		db
			.select({ newsId: newsAttachments.newsId, n: sql<number>`count(*)::int` })
			.from(newsAttachments)
			.where(inArray(newsAttachments.newsId, ids))
			.groupBy(newsAttachments.newsId)
	]);
	const writable = newsUnitIds(p);
	return rows.map((r) => {
		const state = newsState(r, now);
		const tenantNames = targets.filter((t) => t.newsId === r.id).map((t) => t.name);
		return {
			id: r.id,
			title: r.title,
			excerpt: excerpt(r.bodyText),
			publishAt: r.publishAt,
			expiresAt: r.expiresAt,
			pinnedUntil: state.pinned ? r.pinnedUntil : null,
			urgentUntil: r.urgentUntil,
			urgentText: r.urgentText,
			...state,
			sender: {
				id: r.unitId,
				slug: r.unitSlug,
				hub: r.unitType === 'hub',
				name: r.unitName,
				label: unitTypeLabel({ type: r.unitType, title: r.unitTitle })
			},
			audience: r.allTenants
				? 'Alle Mandanten'
				: tenantNames.length > 1
					? tenantNames.join(', ')
					: (tenantNames[0] ?? ''),
			canEdit: writable.has(r.unitId),
			attachmentCount: attachmentCounts.find((a) => a.newsId === r.id)?.n ?? 0,
			reactions: rules.reactions.map((emoji) => ({
				emoji,
				n: counts.find((c) => c.newsId === r.id && c.emoji === emoji)?.n ?? 0,
				mine: mine.some((m) => m.newsId === r.id && m.emoji === emoji)
			}))
		};
	});
}

export type NewsItem = Awaited<ReturnType<typeof decorate>>[number];

export async function listNews(p: Principal, opts: ListOptions = {}) {
	const now = new Date();
	const writable = [...newsUnitIds(p)];
	const editorial = isEditorial(p);
	const conds: SQL[] = [readerVisible(p, writable, editorial, now)];

	if (opts.filter === 'meine') {
		const mineUnits = p.memberships.map((m) => m.unitId);
		conds.push(mineUnits.length ? inArray(news.unitId, mineUnits) : sql`false`);
	}
	if (opts.filter === 'geplant') conds.push(gt(news.publishAt, now));
	if (opts.from) conds.push(eq(news.unitId, opts.from));
	if (opts.unitIds)
		conds.push(opts.unitIds.length ? inArray(news.unitId, opts.unitIds) : sql`false`);
	else if (opts.hubs === 'only') conds.push(sql`${units.type} = 'hub'`);
	else conds.push(sql`${units.type} <> 'hub'`);
	// Archivierte Hubs sind nirgends mehr sichtbar
	conds.push(isNull(units.archivedAt));
	// Hinter den Kulissen hat eine eigene Seite (Kap. 8.4)
	conds.push(eq(news.channel, 'news'));
	const q = opts.q?.trim().slice(0, 100);
	if (q) {
		const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		conds.push(or(ilike(news.title, like), ilike(news.bodyText, like))!);
	}

	const rows = await scoped(p, (tx) =>
		tx
			.select(columns)
			.from(news)
			.innerJoin(units, eq(units.id, news.unitId))
			.where(and(...conds))
			.orderBy(desc(sql`(${news.pinnedUntil} > now())`), desc(news.publishAt))
			.limit(Math.min(opts.limit ?? 50, 100))
	);
	return decorate(p, rows, now);
}

/**
 * Neue Neuigkeiten seit „since“ (Zähler in der Navigation): sichtbar,
 * veröffentlicht, nicht aus Hubs und nicht Hinter den Kulissen.
 */
export async function countNewNews(p: Principal, since: Date): Promise<number> {
	const now = new Date();
	const writable = [...newsUnitIds(p)];
	const [row] = await scoped(p, (tx) =>
		tx
			.select({ n: sql<number>`count(*)::int` })
			.from(news)
			.innerJoin(units, eq(units.id, news.unitId))
			.where(
				and(
					readerVisible(p, writable, isEditorial(p), now),
					lte(news.publishAt, now),
					gt(news.publishAt, since),
					sql`${units.type} <> 'hub'`,
					isNull(units.archivedAt),
					eq(news.channel, 'news')
				)
			)
	);
	return row?.n ?? 0;
}

export async function getNews(p: Principal, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const now = new Date();
	const writable = [...newsUnitIds(p)];
	const [row] = await scoped(p, (tx) =>
		tx
			.select({ ...columns, bodyHtml: news.bodyHtml })
			.from(news)
			.innerJoin(units, eq(units.id, news.unitId))
			.where(
				and(
					eq(news.id, id),
					eq(news.channel, 'news'),
					readerVisible(p, writable, isEditorial(p), now)
				)
			)
	);
	if (!row) return null;
	const [item] = await decorate(p, [row], now);
	return { ...item, bodyHtml: row.bodyHtml, attachments: await attachmentsOf(id) };
}

/** Absender, die in der sichtbaren Liste vorkommen (Filter „Von: …“). */
export async function senders(p: Principal) {
	const items = await listNews(p, { limit: 100 });
	const map = new Map(items.map((i) => [i.sender.id, i.sender]));
	return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Aktive dringende Meldungen für das Banner, ohne zugeklappte. */
export async function urgentForBanner(p: Principal) {
	const now = new Date();
	const rows = await scoped(p, (tx) =>
		tx
			.select(columns)
			.from(news)
			.innerJoin(units, eq(units.id, news.unitId))
			.where(
				and(
					readerVisible(p, [], false, now),
					gt(news.urgentUntil, now),
					sql`not exists (select 1 from urgent_dismissals d where d.news_id = ${news.id} and d.person_id = ${p.personId})`
				)
			)
			.orderBy(desc(news.publishAt))
	);
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		text: r.urgentText ?? '',
		until: r.urgentUntil!,
		sender: r.unitName,
		audience: r.allTenants ? 'Alle Mandanten' : ''
	}));
}

export async function attachmentsOf(newsId: string) {
	return db
		.select({
			id: files.id,
			name: files.name,
			size: files.size,
			kind: files.kind,
			description: files.description
		})
		.from(newsAttachments)
		.innerJoin(files, eq(files.id, newsAttachments.fileId))
		.where(eq(newsAttachments.newsId, newsId))
		.orderBy(asc(newsAttachments.position));
}

/** Angaben zu Anhängen für das erneute Anzeigen des Formulars (nur eigene oder dieses Beitrags). */
export async function describeAttachments(p: Principal, ids: string[], newsId?: string) {
	const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
	if (!valid.length) return [];
	const rows = await db
		.select({
			id: files.id,
			name: files.name,
			size: files.size,
			kind: files.kind,
			description: files.description,
			createdBy: files.createdBy,
			newsId: newsAttachments.newsId
		})
		.from(files)
		.leftJoin(newsAttachments, eq(newsAttachments.fileId, files.id))
		.where(inArray(files.id, valid));
	return valid
		.map((id) => rows.find((r) => r.id === id))
		.filter(
			(r) => r && ((newsId && r.newsId === newsId) || (!r.newsId && r.createdBy === p.personId))
		)
		.map((r) => ({
			id: r!.id,
			name: r!.name,
			size: r!.size,
			kind: r!.kind,
			description: r!.description
		}));
}

/** Zu welchem (sichtbaren) Beitrag gehört die Datei? Für den Download. */
export async function newsOfFile(p: Principal, fileId: string) {
	if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
	const [link] = await db
		.select({ newsId: newsAttachments.newsId })
		.from(newsAttachments)
		.where(eq(newsAttachments.fileId, fileId));
	if (!link) return null;
	return (await getNews(p, link.newsId)) ? link.newsId : null;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export interface SaveInput extends NewsDraft {
	unitId: string;
	bodyHtml: string;
	/** Bestehenden angehefteten Beitrag der Einheit ablösen. */
	replacePin: boolean;
	/** Anhänge in Reihenfolge: behaltene und neu hochgeladene Datei-IDs. */
	attachmentIds: string[];
	/** Bildbeschreibungen je Datei-ID */
	descriptions?: Map<string, string>;
}

/**
 * Prüft die Anhänge: vorhandene dieses Beitrags oder eigene, noch nicht
 * verknüpfte Uploads. Liefert zusätzlich die zu löschenden alten Anhänge.
 */
async function checkAttachments(p: Principal, ids: string[], newsId: string | undefined) {
	const wanted = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
	if (wanted.length > MAX_ATTACHMENTS)
		return { error: `Höchstens ${MAX_ATTACHMENTS} Anhänge je Beitrag.` };
	const current = newsId
		? (
				await db
					.select({ fileId: newsAttachments.fileId })
					.from(newsAttachments)
					.where(eq(newsAttachments.newsId, newsId))
			).map((r) => r.fileId)
		: [];
	const fresh = wanted.filter((id) => !current.includes(id));
	if (fresh.length) {
		const ok = await ownUnlinkedFiles(p.personId, fresh);
		if (ok.length !== fresh.length)
			return { error: 'Ein Anhang ist nicht mehr verfügbar. Lade ihn bitte erneut hoch.' };
	}
	return { wanted, removed: current.filter((id) => !wanted.includes(id)) };
}

export type SaveResult =
	| { ok: true; id: string }
	| { ok: false; errors: NewsErrors; pinConflict?: { id: string; title: string } };

async function loadSender(p: Principal, unitId: string): Promise<SenderUnit> {
	const sender = (await writableUnits(p)).find((u) => u.id === unitId);
	if (!sender) throw new NewsError('Für diese Einheit darfst du nicht schreiben.');
	return sender;
}

export async function saveNews(
	p: Principal,
	input: SaveInput,
	ip: string,
	newsId?: string
): Promise<SaveResult> {
	const sender = await loadSender(p, input.unitId);
	const rules = await getContentRules();
	const now = new Date();

	let existing: typeof news.$inferSelect | undefined;
	if (newsId) {
		[existing] = await db.select().from(news).where(eq(news.id, newsId));
		// Bearbeiten nur mit Recht für den bisherigen Absender
		if (!existing || !newsUnitIds(p).has(existing.unitId))
			throw new NewsError('Beitrag nicht gefunden.');
	}

	const bodyHtml = cleanHtml(input.bodyHtml);
	const bodyText = htmlToText(bodyHtml);
	// Hubs: weder anheften noch dringend (Kap. 8.3)
	const draft: NewsDraft = sender.isHub
		? { ...input, bodyText, pinnedUntil: null, urgentUntil: null, urgentText: null }
		: { ...input, bodyText };

	const [{ n: otherUrgent }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(news)
		.where(
			and(
				eq(news.unitId, sender.id),
				gt(news.urgentUntil, now),
				newsId ? ne(news.id, newsId) : undefined
			)
		);

	const errors = validateNews(draft, {
		now,
		unitIsCentral: sender.isCentral,
		unitTenantId: sender.tenantId,
		unitMayPostUrgent: sender.mayUrgent,
		pinMaxDays: rules.pinMaxDays,
		urgentMaxDays: rules.urgentMaxDays,
		otherActiveUrgent: otherUrgent,
		urgentPerUnit: rules.urgentPerUnit
	});
	// Freigabe in der Vergangenheit nur bei bestehenden Beiträgen
	if (!existing && input.publishAt && input.publishAt.getTime() < now.getTime() - 5 * 60_000) {
		errors.publishAt = 'Die Freigabe darf nicht in der Vergangenheit liegen.';
	}

	// Zielmandanten prüfen
	const targets = effectiveTargets(draft, {
		unitIsCentral: sender.isCentral,
		unitTenantId: sender.tenantId
	});
	if (targets.tenantIds.length) {
		const known = await db
			.select({ id: tenants.id })
			.from(tenants)
			.where(inArray(tenants.id, targets.tenantIds));
		if (known.length !== targets.tenantIds.length) errors.tenants = 'Unbekannter Mandant.';
	}

	// Anheften: je Absender begrenzt, Redaktion mit eigener Grenze (Kap. 8.1)
	const editorial = isEditorial(p);
	let pinConflict: { id: string; title: string } | undefined;
	let unpinIds: string[] = [];
	if (draft.pinnedUntil && !errors.pinnedUntil) {
		const activePins = await db
			.select({
				id: news.id,
				title: news.title,
				unitId: news.unitId,
				byEditorial: news.pinnedByEditorial,
				pinnedUntil: news.pinnedUntil
			})
			.from(news)
			.where(and(gt(news.pinnedUntil, now), newsId ? ne(news.id, newsId) : undefined))
			.orderBy(asc(news.pinnedUntil));
		const relevant = editorial
			? activePins.filter((x) => x.byEditorial)
			: activePins.filter((x) => x.unitId === sender.id && !x.byEditorial);
		const limit = editorial ? rules.pinEditorial : rules.pinPerSender;
		if (relevant.length >= limit) {
			if (input.replacePin) {
				// Die am frühesten endenden lösen, bis Platz ist
				unpinIds = relevant.slice(0, relevant.length - limit + 1).map((x) => x.id);
			} else {
				pinConflict = { id: relevant[0].id, title: relevant[0].title };
				errors.pinnedUntil = editorial
					? `Die Redaktion hat schon ${limit} angeheftete Beiträge.`
					: `${sender.name} hat schon einen angehefteten Beitrag: „${relevant[0].title}“.`;
			}
		}
	}

	const att = await checkAttachments(p, input.attachmentIds, newsId);
	if ('error' in att) errors.attachments = att.error;

	if (Object.keys(errors).length > 0 || 'error' in att) return { ok: false, errors, pinConflict };

	const values = {
		unitId: sender.id,
		tenantId: sender.tenantId,
		title: draft.title.trim(),
		bodyHtml,
		bodyText,
		publishAt: draft.publishAt!,
		expiresAt: draft.expiresAt,
		allTenants: targets.allTenants,
		pinnedUntil: draft.pinnedUntil,
		pinnedByEditorial: Boolean(draft.pinnedUntil) && editorial,
		urgentUntil: draft.urgentUntil,
		urgentText: draft.urgentUntil ? draft.urgentText!.trim() : null,
		updatedBy: p.personId
	};
	// Abgelaufene Dringlichkeit bleibt erhalten („War dringend bis …“)
	if (existing?.urgentUntil && existing.urgentUntil <= now && !draft.urgentUntil) {
		values.urgentUntil = existing.urgentUntil;
		values.urgentText = existing.urgentText;
	}

	const id = await db.transaction(async (tx) => {
		if (unpinIds.length)
			await tx
				.update(news)
				.set({ pinnedUntil: null, pinnedByEditorial: false })
				.where(inArray(news.id, unpinIds));
		let id = newsId;
		if (id) {
			await tx.update(news).set(values).where(eq(news.id, id));
			await tx.delete(newsTenants).where(eq(newsTenants.newsId, id));
		} else {
			const [row] = await tx
				.insert(news)
				.values({ ...values, createdBy: p.personId })
				.returning({ id: news.id });
			id = row.id;
		}
		if (targets.tenantIds.length) {
			await tx
				.insert(newsTenants)
				.values(targets.tenantIds.map((tenantId) => ({ newsId: id!, tenantId })));
		}
		await tx.delete(newsAttachments).where(eq(newsAttachments.newsId, id));
		if (att.wanted.length) {
			await tx
				.insert(newsAttachments)
				.values(att.wanted.map((fileId, position) => ({ newsId: id!, fileId, position })));
		}
		await beschreibungenSpeichern(tx, att.wanted, input.descriptions);
		return id;
	});
	// Entfernte Anhänge sofort löschen (Schlüssel und Datei, Kap. 15)
	await deleteStored(att.removed);

	await audit({
		category: 'admin',
		action: newsId ? 'news.update' : 'news.create',
		actorId: p.personId,
		tenantId: sender.tenantId,
		entityType: 'news',
		entityId: id,
		// Keine Inhalte protokollieren (Kap. 14)
		details: {
			unitId: sender.id,
			urgent: Boolean(values.urgentUntil),
			pinned: Boolean(values.pinnedUntil),
			unpinned: unpinIds,
			attachments: att.wanted.length,
			attachmentsRemoved: att.removed.length
		},
		ip
	});
	return { ok: true, id };
}

/** Rohdaten zum Bearbeiten. */
export async function newsForEdit(p: Principal, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const [row] = await db.select().from(news).where(eq(news.id, id));
	if (!row || !newsUnitIds(p).has(row.unitId)) return null;
	const targets = await db
		.select({ tenantId: newsTenants.tenantId })
		.from(newsTenants)
		.where(eq(newsTenants.newsId, id));
	return {
		...row,
		tenantIds: targets.map((t) => t.tenantId),
		attachments: await attachmentsOf(id)
	};
}

export async function deleteNews(p: Principal, id: string, ip: string) {
	const [row] = await db
		.select({ unitId: news.unitId, tenantId: news.tenantId })
		.from(news)
		.where(eq(news.id, id));
	if (!row || !newsUnitIds(p).has(row.unitId)) throw new NewsError('Beitrag nicht gefunden.');
	const fileIds = (
		await db
			.select({ fileId: newsAttachments.fileId })
			.from(newsAttachments)
			.where(eq(newsAttachments.newsId, id))
	).map((r) => r.fileId);
	await db.delete(news).where(eq(news.id, id));
	await deleteStored(fileIds);
	await audit({
		category: 'admin',
		action: 'news.delete',
		actorId: p.personId,
		tenantId: row.tenantId,
		entityType: 'news',
		entityId: id,
		ip
	});
}

// ---------------------------------------------------------------------------
// Reaktionen und Banner
// ---------------------------------------------------------------------------

/** Setzt, wechselt oder entfernt die eigene Reaktion. */
export async function react(p: Principal, newsId: string, emoji: string) {
	if (!(await getNews(p, newsId))) throw new NewsError('Beitrag nicht gefunden.');
	await toggleReaction(p, newsId, emoji);
}

/** Reaktion setzen, wechseln oder (gleiche noch einmal) entfernen. Sichtbarkeit prüft der Aufrufer. */
export async function toggleReaction(p: Principal, newsId: string, emoji: string) {
	const rules = await getContentRules();
	if (!rules.reactions.includes(emoji)) throw new NewsError('Unbekannte Reaktion.');
	const [current] = await db
		.select({ emoji: newsReactions.emoji })
		.from(newsReactions)
		.where(and(eq(newsReactions.newsId, newsId), eq(newsReactions.personId, p.personId)));
	if (current?.emoji === emoji) {
		await db
			.delete(newsReactions)
			.where(and(eq(newsReactions.newsId, newsId), eq(newsReactions.personId, p.personId)));
	} else {
		await db
			.insert(newsReactions)
			.values({ newsId, personId: p.personId, emoji })
			.onConflictDoUpdate({
				target: [newsReactions.newsId, newsReactions.personId],
				set: { emoji }
			});
	}
}

export async function dismissUrgent(p: Principal, newsId: string) {
	if (!(await getNews(p, newsId))) throw new NewsError('Beitrag nicht gefunden.');
	await db.insert(urgentDismissals).values({ newsId, personId: p.personId }).onConflictDoNothing();
}

/** Globale Suche (Kap. 8.14): sichtbare Neuigkeiten und Hub-Beiträge. */
export async function searchNews(p: Principal, tsq: string, limit = 20) {
	const now = new Date();
	const document = doc(news.title, news.bodyText);
	return scoped(p, (tx) =>
		tx
			.select({
				id: news.id,
				title: news.title,
				publishAt: news.publishAt,
				unitName: units.name,
				isHub: sql<boolean>`${units.type} = 'hub'`,
				snippet: headline(news.bodyText, tsq)
			})
			.from(news)
			.innerJoin(units, eq(units.id, news.unitId))
			.where(
				and(
					readerVisible(p, [...newsUnitIds(p)], isEditorial(p), now),
					lte(news.publishAt, now),
					isNull(units.archivedAt),
					eq(news.channel, 'news'),
					matches(document, tsq)
				)
			)
			.orderBy(desc(rank(document, tsq)), desc(news.publishAt))
			.limit(limit)
	);
}
