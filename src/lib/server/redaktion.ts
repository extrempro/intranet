/**
 * Bereich Redaktion (Kap. 10): Arbeitsliste ohne Einstellungen. Sichtbar mit
 * der Rolle Redaktion (je Mandant oder alle); mit der Rolle Moderation
 * Schwarzes Brett nur der Abschnitt Schwarzes Brett.
 */
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { unitTypeLabel } from '../roles.ts';
import { isEditorial, type Principal } from './auth/access.ts';
import { isModerator, moderationQueue } from './board.ts';
import { db } from './db/index.ts';
import { faqs, hubApplications, news, persons, tenants, units } from './db/schema.ts';

/** Mandanten, für die die Person Redaktion ist. */
async function editorialTenants(p: Principal) {
	const all = await db
		.select({ id: tenants.id, short: tenants.shortName })
		.from(tenants)
		.orderBy(asc(tenants.name));
	return all.filter((t) => isEditorial(p, t.id));
}

export function mayOpenEditorial(p: Principal) {
	return p.roles.some((r) => r.role === 'redaktion') || isModerator(p);
}

export async function editorialWorklist(p: Principal) {
	const tenantList = await editorialTenants(p);
	const tenantIds = tenantList.map((t) => t.id);
	const redaktion = tenantIds.length > 0;
	const now = new Date();
	const inAWeek = new Date(now.getTime() + 7 * 86400_000);
	const yearAgo = new Date(now.getTime() - 365 * 86400_000);
	// Einheiten im Zuständigkeitsbereich: eigener Mandant(en) und zentrale
	const unitScope = redaktion
		? and(
				isNull(units.archivedAt),
				or(inArray(units.tenantId, tenantIds), eq(units.isCentral, true))
			)
		: sql`false`;

	const [ohnePflege, ablaufend, alteFaqs, inaktiv, hervorgehoben, antraege, brett] =
		await Promise.all([
			// Ohne eigene Pflege: keine Abteilungsverwaltung bzw. kein Hub-Team
			redaktion
				? db
						.select({
							id: units.id,
							name: units.name,
							type: units.type,
							title: units.title,
							slug: units.slug,
							tenantShort: tenants.shortName
						})
						.from(units)
						.innerJoin(tenants, eq(tenants.id, units.tenantId))
						.where(
							and(
								unitScope,
								eq(units.hidden, false),
								sql`not exists (select 1 from role_assignments r where r.scope_unit_id = ${units.id} and r.role in ('abteilungsverwaltung', 'hub_team'))`
							)
						)
						.orderBy(asc(units.name))
				: [],
			// Bald ablaufende Beiträge (7 Tage)
			redaktion
				? db
						.select({
							id: news.id,
							title: news.title,
							expiresAt: news.expiresAt,
							unitName: units.name
						})
						.from(news)
						.innerJoin(units, eq(units.id, news.unitId))
						.where(
							and(
								unitScope,
								isNotNull(news.expiresAt),
								gt(news.expiresAt, now),
								lt(news.expiresAt, inAWeek)
							)
						)
						.orderBy(asc(news.expiresAt))
				: [],
			// Lange nicht geänderte FAQs (12 Monate)
			redaktion
				? db
						.select({
							id: faqs.id,
							question: faqs.question,
							updatedAt: faqs.updatedAt,
							unitName: units.name
						})
						.from(faqs)
						.innerJoin(units, eq(units.id, faqs.unitId))
						.where(and(unitScope, lt(faqs.updatedAt, yearAgo)))
						.orderBy(asc(faqs.updatedAt))
						.limit(100)
				: [],
			// Inaktive Ansprechpersonen: gesperrte Konten als Leitung oder im Hub-Team
			redaktion
				? db
						.selectDistinct({
							personId: persons.id,
							name: persons.displayName,
							unitId: units.id,
							unitName: units.name,
							slug: units.slug,
							type: units.type
						})
						.from(units)
						.innerJoin(
							persons,
							or(
								eq(persons.id, units.leadPersonId),
								eq(persons.id, units.secondLeadPersonId),
								eq(persons.id, units.deputyPersonId),
								sql`exists (select 1 from role_assignments r where r.person_id = ${persons.id} and r.scope_unit_id = ${units.id} and r.role = 'hub_team')`
							)
						)
						.where(and(unitScope, eq(persons.status, 'disabled')))
						.orderBy(asc(units.name))
				: [],
			// Dringend und angeheftet: Überblick über alle Einheiten
			redaktion
				? db
						.select({
							id: news.id,
							title: news.title,
							unitName: units.name,
							urgentUntil: news.urgentUntil,
							pinnedUntil: news.pinnedUntil,
							byEditorial: news.pinnedByEditorial
						})
						.from(news)
						.innerJoin(units, eq(units.id, news.unitId))
						.where(and(unitScope, or(gt(news.urgentUntil, now), gt(news.pinnedUntil, now))))
						.orderBy(sql`${news.urgentUntil} desc nulls last`, asc(news.pinnedUntil))
				: [],
			// Hub-Anträge vorprüfen
			redaktion
				? db
						.select({
							id: hubApplications.id,
							name: hubApplications.name,
							createdAt: hubApplications.createdAt
						})
						.from(hubApplications)
						.where(
							and(eq(hubApplications.status, 'neu'), inArray(hubApplications.tenantId, tenantIds))
						)
						.orderBy(asc(hubApplications.createdAt))
				: [],
			isModerator(p) ? moderationQueue(p) : Promise.resolve([])
		]);

	return {
		redaktion,
		moderation: isModerator(p),
		mandanten: tenantList.map((t) => t.short),
		ohnePflege: ohnePflege.map((u) => ({ ...u, label: unitTypeLabel(u) })),
		zuPruefen: { ablaufend, alteFaqs, inaktiv },
		hervorgehoben,
		antraege,
		brett: brett.map((a) => ({
			id: a.id,
			title: a.title,
			tenantShort: a.tenantShort,
			gemeldet: a.status === 'active'
		}))
	};
}
