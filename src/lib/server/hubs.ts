/**
 * Hubs (Kap. 8.3, 8.12): Themengruppen mit eigener Seite, Abo je Hub,
 * Pflicht-Abo, Ruhen (Hub-Team) und Archivieren (Verwaltung) sowie Anträge
 * mit Vorprüfung durch die Redaktion. Sichtbar und abonnierbar sind Hubs des
 * eigenen Mandanten und zentrale Hubs.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { addDays, berlinNow } from '../canteen.ts';
import {
	cleanLayout,
	HUB_GRENZEN,
	parseTeam,
	validateApplication,
	type HubApplicationErrors,
	type HubApplicationInput,
	type HubLayout
} from '../hubs.ts';
import { audit } from './audit.ts';
import {
	canAdministerTenant,
	canManageUnit,
	hasUnitRole,
	isEditorial,
	type Principal
} from './auth/access.ts';
import { getRetention } from './retention.ts';
import { getContentRules } from './rules.ts';
import { db } from './db/index.ts';
import {
	conversations,
	events,
	faqs,
	hubApplications,
	hubSubscriptions,
	messages,
	personPreferences,
	persons,
	roleAssignments,
	tenants,
	unitMembers,
	units
} from './db/schema.ts';
import {
	closeByRef,
	findConversation,
	postAsRole,
	roleMembers,
	startConversation,
	type RoleBox
} from './messages.ts';
import { notify } from './notify.ts';
import { createUnit, UnitError } from './units.ts';
import { bilderVerknuepfen, textMitBildern } from './textbilder.ts';

export class HubError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hubs, die die Person sehen und abonnieren darf. */
function inScope(p: Principal) {
	return and(
		eq(units.type, 'hub'),
		isNull(units.archivedAt),
		eq(units.hidden, false),
		or(eq(units.isCentral, true), eq(units.tenantId, p.tenantId))
	)!;
}

// ---------------------------------------------------------------------------
// Liste, Seite, Abo
// ---------------------------------------------------------------------------

export async function listHubs(p: Principal, onlyMine = false) {
	const rows = await db
		.select({
			id: units.id,
			slug: units.slug,
			name: units.name,
			about: units.about,
			isCentral: units.isCentral,
			resting: units.restingSince,
			mandatory: units.mandatorySubscription,
			iconFileId: units.iconFileId,
			tenantId: units.tenantId,
			tenantShort: tenants.shortName,
			subscribed: sql<boolean>`exists (select 1 from hub_subscriptions s where s.unit_id = ${units.id} and s.person_id = ${p.personId})`
		})
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(inScope(p))
		.orderBy(asc(units.name));
	return rows
		.map(({ iconFileId, ...r }) => ({
			...r,
			iconUrl: iconFileId ? `/dateien/${iconFileId}` : null,
			subscribed: r.subscribed || r.mandatory
		}))
		.filter((r) => !onlyMine || r.subscribed);
}

/** IDs der abonnierten Hubs (inkl. Pflicht-Abos). */
export async function subscribedHubIds(p: Principal): Promise<string[]> {
	return (await listHubs(p, true)).map((h) => h.id);
}

export async function getHub(p: Principal, slug: string) {
	if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
	const [hub] = await db
		.select({ unit: units, tenantName: tenants.name, tenantShort: tenants.shortName })
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(and(eq(units.slug, slug), inScope(p)));
	if (!hub) return null;
	const u = hub.unit;
	const managers = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(roleAssignments)
		.where(and(eq(roleAssignments.role, 'hub_team'), eq(roleAssignments.scopeUnitId, u.id)));
	const canManage =
		canManageUnit(p, u, (managers[0]?.n ?? 0) > 0) || canAdministerTenant(p, u.tenantId);
	const [sub] = await db
		.select()
		.from(hubSubscriptions)
		.where(and(eq(hubSubscriptions.personId, p.personId), eq(hubSubscriptions.unitId, u.id)));
	const today = berlinNow().date;
	const { hubInhalte } = await import('./hub-inhalte.ts');
	const [inhalte, faqListe, abonnierende, termine] = await Promise.all([
		hubInhalte(u.id, u.coordinatorPersonId),
		db
			.select({ id: faqs.id, question: faqs.question })
			.from(faqs)
			.where(eq(faqs.unitId, u.id))
			.orderBy(asc(faqs.position), asc(faqs.createdAt)),
		canManage
			? db
					.select({ n: sql<number>`count(*)::int` })
					.from(hubSubscriptions)
					.where(eq(hubSubscriptions.unitId, u.id))
					.then((r) => r[0]?.n ?? 0)
			: Promise.resolve(null),
		db
			.select({
				id: events.id,
				title: events.title,
				date: events.date,
				allDay: events.allDay,
				startTime: events.startTime,
				endTime: events.endTime,
				place: events.place
			})
			.from(events)
			.where(
				and(eq(events.unitId, u.id), gte(events.date, today), lt(events.date, addDays(today, 120)))
			)
			.orderBy(asc(events.date), asc(events.startTime))
			.limit(30)
	]);
	return {
		id: u.id,
		slug: u.slug,
		name: u.name,
		about: u.about,
		aboutHtml: u.aboutHtml,
		// Hinweis oben gilt bis einschließlich „Anzeigen bis“
		notice: u.notice && (!u.noticeUntil || u.noticeUntil >= today) ? u.notice : null,
		noticeRaw: u.notice,
		noticeUntil: u.noticeUntil,
		coordinatorId: u.coordinatorPersonId,
		coverUrl: u.coverFileId ? `/dateien/${u.coverFileId}` : null,
		iconUrl: u.iconFileId ? `/dateien/${u.iconFileId}` : null,
		isCentral: u.isCentral,
		tenantName: hub.tenantName,
		tenantShort: hub.tenantShort,
		resting: u.restingSince,
		mandatory: u.mandatorySubscription,
		layout: cleanLayout(u.pageLayout),
		subscribed: Boolean(sub) || u.mandatorySubscription,
		channels: { bell: sub?.bell ?? true, push: sub?.push ?? false, email: sub?.email ?? false },
		canManage,
		canPost:
			canManage ||
			hasUnitRole(p, 'hub_team', u.id) ||
			p.memberships.some((m) => m.unitId === u.id && m.mayWriteNews),
		canAdminister: canAdministerTenant(p, u.tenantId),
		canFaqs:
			canManage ||
			hasUnitRole(p, 'hub_team', u.id) ||
			p.memberships.some((m) => m.unitId === u.id && m.mayWriteFaqs),
		canDocs: canManage || p.memberships.some((m) => m.unitId === u.id && m.mayWriteDocuments),
		/** Pflicht-Abo: alle; sonst Zahl der Abos (nur für die Pflege) */
		abonnierende: u.mandatorySubscription ? null : abonnierende,
		...inhalte,
		faqs: faqListe,
		termine
	};
}

async function hubInScope(p: Principal, unitId: string) {
	if (!GUID.test(unitId)) throw new HubError('Hub nicht gefunden.');
	const [u] = await db
		.select()
		.from(units)
		.where(and(eq(units.id, unitId), inScope(p)));
	if (!u) throw new HubError('Hub nicht gefunden.');
	return u;
}

export interface HubChannels {
	bell: boolean;
	push: boolean;
	email: boolean;
}

/** Voreinstellung der Kanäle für Hubs ohne eigene Einstellung. */
export const HUB_DEFAULTS: HubChannels = { bell: true, push: false, email: false };

/** Eigener „Standard für neue Abos“ (Meine Hubs). */
export async function getHubDefaults(personId: string): Promise<HubChannels> {
	const [r] = await db
		.select({ d: personPreferences.hubDefaults })
		.from(personPreferences)
		.where(eq(personPreferences.personId, personId));
	return r?.d ?? HUB_DEFAULTS;
}

export async function setHubDefaults(personId: string, d: HubChannels) {
	const hubDefaults = { bell: d.bell, push: d.push, email: d.email };
	await db
		.insert(personPreferences)
		.values({ personId, hubDefaults })
		.onConflictDoUpdate({ target: personPreferences.personId, set: { hubDefaults } });
}

/** Standard auf alle Abos (auch Pflicht-Abos) übertragen. */
export async function applyHubDefaults(p: Principal) {
	const d = await getHubDefaults(p.personId);
	for (const h of await myHubs(p)) await setChannels(p, h.id, d.bell, d.push, d.email);
}

/** Alle freiwilligen Abos beenden; Pflicht-Abos bleiben. */
export async function unsubscribeAllOptional(p: Principal): Promise<number> {
	const optional = (await myHubs(p)).filter((h) => !h.mandatory);
	for (const h of optional) await unsubscribe(p, h.id);
	return optional.length;
}

export async function subscribe(p: Principal, unitId: string) {
	await hubInScope(p, unitId);
	const d = await getHubDefaults(p.personId);
	await db
		.insert(hubSubscriptions)
		.values({ personId: p.personId, unitId, ...d })
		.onConflictDoNothing();
}

export async function unsubscribe(p: Principal, unitId: string) {
	const u = await hubInScope(p, unitId);
	if (u.mandatorySubscription) throw new HubError('Das ist ein Pflicht-Abo.');
	await db
		.delete(hubSubscriptions)
		.where(and(eq(hubSubscriptions.personId, p.personId), eq(hubSubscriptions.unitId, unitId)));
}

export async function setChannels(
	p: Principal,
	unitId: string,
	bell: boolean,
	push: boolean,
	email: boolean
) {
	await hubInScope(p, unitId);
	await db
		.insert(hubSubscriptions)
		.values({ personId: p.personId, unitId, bell, push, email })
		.onConflictDoUpdate({
			target: [hubSubscriptions.personId, hubSubscriptions.unitId],
			set: { bell, push, email }
		});
}

/** „Meine Hubs“: Abos mit Kanälen; Pflicht-Abos immer dabei. */
export async function myHubs(p: Principal) {
	const hubs = await listHubs(p, true);
	const subs = await db
		.select()
		.from(hubSubscriptions)
		.where(eq(hubSubscriptions.personId, p.personId));
	const d = await getHubDefaults(p.personId);
	return hubs.map((h) => {
		const s = subs.find((x) => x.unitId === h.id);
		const k = s ?? HUB_DEFAULTS;
		return {
			...h,
			bell: k.bell,
			push: k.push,
			email: k.email,
			/** weicht vom eigenen Standard ab */
			eigen: k.bell !== d.bell || k.push !== d.push || k.email !== d.email
		};
	});
}

/** Empfänger eines Hub-Beitrags mit ihren Kanälen (Abos und Pflicht-Abo). */
export async function hubRecipients(unitId: string) {
	const [u] = await db.select().from(units).where(eq(units.id, unitId));
	if (!u || u.archivedAt) return [];
	const subs = await db.select().from(hubSubscriptions).where(eq(hubSubscriptions.unitId, unitId));
	const list = new Map(
		subs.map((s) => [
			s.personId,
			{ personId: s.personId, bell: s.bell, push: s.push, email: s.email }
		])
	);
	if (u.mandatorySubscription) {
		const all = await db
			.select({ id: persons.id })
			.from(persons)
			.where(
				and(
					sql`${persons.status} <> 'disabled'`,
					u.isCentral ? undefined : eq(persons.tenantId, u.tenantId)
				)
			);
		for (const a of all)
			if (!list.has(a.id))
				list.set(a.id, { personId: a.id, bell: true, push: false, email: false });
	} else if (!u.isCentral) {
		// Abos aus anderen Mandanten gelten nicht (nur eigener Mandant und zentrale Hubs)
		const keys = [...list.keys()];
		const own = new Set(
			keys.length
				? (
						await db
							.select({ id: persons.id })
							.from(persons)
							.where(and(inArray(persons.id, keys), eq(persons.tenantId, u.tenantId)))
					).map((r) => r.id)
				: []
		);
		for (const k of keys) if (!own.has(k)) list.delete(k);
	}
	return [...list.values()];
}

// ---------------------------------------------------------------------------
// Pflege durch das Hub-Team
// ---------------------------------------------------------------------------

/** Hub pflegen: Hub-Team, Redaktion (ohne Hub-Team) und Verwaltung des Mandanten. */
export async function manageable(p: Principal, unitId: string) {
	const u = await hubInScope(p, unitId);
	const [m] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(roleAssignments)
		.where(and(eq(roleAssignments.role, 'hub_team'), eq(roleAssignments.scopeUnitId, u.id)));
	if (!canManageUnit(p, u, (m?.n ?? 0) > 0) && !canAdministerTenant(p, u.tenantId))
		throw new HubError('Dafür fehlt dir das Recht.');
	return u;
}

/** Dokumente pflegen: wer den Hub pflegt oder das Recht „Dokumente“ hat. */
export async function dokumentePflegbar(p: Principal, unitId: string) {
	const u = await hubInScope(p, unitId);
	if (p.memberships.some((m) => m.unitId === u.id && m.mayWriteDocuments)) return u;
	return manageable(p, unitId);
}

/** Darf die Person diesen Hub sehen? (für Bilder und Dokumente) */
export async function hubSichtbar(p: Principal, unitId: string): Promise<boolean> {
	if (!GUID.test(unitId)) return false;
	const [u] = await db
		.select({ id: units.id })
		.from(units)
		.where(and(eq(units.id, unitId), inScope(p)));
	return Boolean(u);
}

export async function updateHubPage(
	p: Principal,
	unitId: string,
	input: {
		notice: string;
		noticeUntil: string;
		about: string;
		aboutHtml: string;
		coordinator: string;
		layout: HubLayout;
	}
): Promise<{ fehler?: string }> {
	await manageable(p, unitId);
	const text = await textMitBildern(p, input.aboutHtml, { art: 'unit', id: unitId });
	if (text.fehler) return { fehler: text.fehler };
	const bis = /^\d{4}-\d{2}-\d{2}$/.test(input.noticeUntil) ? input.noticeUntil : null;
	// Koordination nur aus dem Hub-Team
	let koordination: string | null = null;
	if (GUID.test(input.coordinator)) {
		const [t] = await db
			.select({ id: roleAssignments.personId })
			.from(roleAssignments)
			.where(
				and(
					eq(roleAssignments.role, 'hub_team'),
					eq(roleAssignments.scopeUnitId, unitId),
					eq(roleAssignments.personId, input.coordinator)
				)
			);
		if (!t) return { fehler: 'Die Koordination übernimmt eine Person aus dem Hub-Team.' };
		koordination = t.id;
	}
	await db.transaction(async (tx) => {
		await tx
			.update(units)
			.set({
				notice: input.notice.trim().slice(0, HUB_GRENZEN.hinweis) || null,
				noticeUntil: input.notice.trim() ? bis : null,
				about: input.about.trim().replace(/\s+/g, ' ').slice(0, HUB_GRENZEN.kurz) || null,
				aboutHtml: text.html || null,
				coordinatorPersonId: koordination,
				pageLayout: cleanLayout(input.layout)
			})
			.where(eq(units.id, unitId));
		await bilderVerknuepfen(tx, { art: 'unit', id: unitId }, text.bilder);
	});
	return {};
}

export async function setResting(p: Principal, unitId: string, resting: boolean, ip: string) {
	const u = await manageable(p, unitId);
	await db
		.update(units)
		.set({ restingSince: resting ? new Date() : null })
		.where(eq(units.id, unitId));
	await audit({
		category: 'admin',
		action: resting ? 'hub.rest' : 'hub.resume',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: unitId,
		ip
	});
}

/** Archivieren nur durch die Verwaltung; danach nirgends sichtbar, Löschung nach Frist. */
export async function archiveHub(p: Principal, unitId: string, ip: string) {
	if (!GUID.test(unitId)) throw new HubError('Hub nicht gefunden.');
	const [u] = await db
		.select()
		.from(units)
		.where(and(eq(units.id, unitId), eq(units.type, 'hub')));
	if (!u || !canAdministerTenant(p, u.tenantId)) throw new HubError('Hub nicht gefunden.');
	await db.update(units).set({ archivedAt: new Date() }).where(eq(units.id, unitId));
	await audit({
		category: 'admin',
		action: 'hub.archive',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: { name: u.name },
		ip
	});
}

// ---------------------------------------------------------------------------
// Anträge (Kap. 8.12)
// ---------------------------------------------------------------------------

export async function applyForHub(
	p: Principal,
	input: HubApplicationInput
): Promise<{ ok: true } | { ok: false; errors: HubApplicationErrors }> {
	const errors = validateApplication(input);
	if (Object.keys(errors).length) return { ok: false, errors };
	const me = await db
		.select({ email: persons.email })
		.from(persons)
		.where(eq(persons.id, p.personId));
	const team = [
		...new Set([me[0]?.email.toLowerCase(), ...parseTeam(input.team)].filter(Boolean))
	] as string[];
	const [row] = await db
		.insert(hubApplications)
		.values({
			applicantId: p.personId,
			tenantId: p.tenantId,
			name: input.name.trim(),
			description: input.description.trim(),
			reason: input.reason.trim(),
			team,
			central: input.central,
			status: 'neu'
		})
		.returning({ id: hubApplications.id });
	const link = '/hubs/antraege';
	await notify('nachrichten', await roleMembers('redaktion', p.tenantId), {
		title: `Hub-Antrag: ${input.name.trim()}`,
		detail: 'Vorprüfung',
		link
	});
	void row;
	return { ok: true };
}

export type ApplicationRole = 'redaktion' | 'verwaltung';

/** Welche Rolle(n) hat die Person für Anträge dieses Mandanten? */
function rolesFor(p: Principal, tenantId: string): ApplicationRole[] {
	const r: ApplicationRole[] = [];
	if (isEditorial(p, tenantId)) r.push('redaktion');
	if (canAdministerTenant(p, tenantId)) r.push('verwaltung');
	return r;
}

export function mayReviewApplications(p: Principal) {
	return p.roles.some((r) => ['redaktion', 'mandanten_admin', 'system_admin'].includes(r.role));
}

export async function listApplications(p: Principal, open = true) {
	const rows = await db
		.select({
			a: hubApplications,
			applicant: persons.displayName,
			tenantShort: tenants.shortName
		})
		.from(hubApplications)
		.leftJoin(persons, eq(persons.id, hubApplications.applicantId))
		.innerJoin(tenants, eq(tenants.id, hubApplications.tenantId))
		.where(
			open
				? inArray(hubApplications.status, ['neu', 'bei_verwaltung'])
				: inArray(hubApplications.status, ['angelegt', 'abgelehnt', 'geschlossen'])
		)
		.orderBy(open ? asc(hubApplications.createdAt) : desc(hubApplications.updatedAt))
		.limit(200);
	const result = [];
	for (const r of rows) {
		const roles = rolesFor(p, r.a.tenantId);
		if (!roles.length) continue;
		const conv = await db
			.select({
				id: conversations.id,
				roleBox: conversations.roleBox,
				closedAt: conversations.closedAt
			})
			.from(conversations)
			.where(and(eq(conversations.kind, 'hub_antrag'), eq(conversations.refId, r.a.id)))
			.orderBy(desc(conversations.createdAt));
		result.push({
			...r.a,
			applicant: r.applicant ?? 'Gelöschtes Konto',
			tenantShort: r.tenantShort,
			roles,
			conversations: conv
		});
	}
	return result;
}

export async function myApplications(p: Principal) {
	return db
		.select()
		.from(hubApplications)
		.where(eq(hubApplications.applicantId, p.personId))
		.orderBy(desc(hubApplications.createdAt));
}

async function reviewable(p: Principal, id: string, role: ApplicationRole) {
	if (!GUID.test(id)) throw new HubError('Antrag nicht gefunden.');
	const [a] = await db.select().from(hubApplications).where(eq(hubApplications.id, id));
	if (!a || !rolesFor(p, a.tenantId).includes(role)) throw new HubError('Antrag nicht gefunden.');
	if (a.status !== 'neu' && a.status !== 'bei_verwaltung')
		throw new HubError('Der Antrag ist schon abgeschlossen.');
	return a;
}

/** Rückfrage: öffnet (oder findet) das Gespräch mit der antragstellenden Person. */
export async function askApplicant(p: Principal, id: string, role: ApplicationRole) {
	const a = await reviewable(p, id, role);
	if (!a.applicantId) throw new HubError('Die antragstellende Person gibt es nicht mehr.');
	const existing = await db
		.select({ id: conversations.id })
		.from(conversations)
		.where(
			and(
				eq(conversations.kind, 'hub_antrag'),
				eq(conversations.refId, id),
				eq(conversations.roleBox, role as RoleBox),
				isNull(conversations.closedAt)
			)
		);
	if (existing[0]) return existing[0].id;
	return startConversation({
		kind: 'hub_antrag',
		subject: `Hub-Antrag: ${a.name}`,
		refId: id,
		memberIds: [a.applicantId],
		roleBox: role,
		roleTenantId: a.tenantId
	});
}

export async function forwardToAdministration(p: Principal, id: string) {
	const a = await reviewable(p, id, 'redaktion');
	if (a.status !== 'neu') throw new HubError('Der Antrag liegt schon bei der Verwaltung.');
	await db
		.update(hubApplications)
		.set({ status: 'bei_verwaltung' })
		.where(eq(hubApplications.id, id));
	await notify('nachrichten', await roleMembers('verwaltung', a.tenantId), {
		title: `Hub-Antrag: ${a.name}`,
		detail: 'Von der Redaktion vorgeprüft',
		link: '/hubs/antraege'
	});
}

async function informApplicant(
	a: { id: string; name: string; tenantId: string; applicantId: string | null },
	authorId: string,
	text: string
) {
	if (!a.applicantId) return;
	const conv =
		(await findConversation('hub_antrag', a.id, a.applicantId))?.id ??
		(await startConversation({
			kind: 'hub_antrag',
			subject: `Hub-Antrag: ${a.name}`,
			refId: a.id,
			memberIds: [a.applicantId],
			roleBox: 'verwaltung',
			roleTenantId: a.tenantId
		}));
	await db.update(conversations).set({ closedAt: null }).where(eq(conversations.id, conv));
	await postAsRole(conv, authorId, text);
	await notify('nachrichten', [a.applicantId], {
		title: `Hub-Antrag: ${a.name}`,
		detail: 'Verwaltung',
		link: `/nachrichten/${conv}`
	});
	await closeByRef(a.id);
}

/** Verwaltung legt den Hub an: Einheit vom Typ Hub, Hub-Team aus dem Antrag. */
export async function createHubFromApplication(p: Principal, id: string, ip: string) {
	const a = await reviewable(p, id, 'verwaltung');
	let tenantId = a.tenantId;
	if (a.central) {
		const [main] = await db
			.select({ id: tenants.id })
			.from(tenants)
			.where(eq(tenants.isMain, true));
		if (!main || !canAdministerTenant(p, main.id))
			throw new HubError('Zentrale Hubs legt die Verwaltung des Hauptmandanten an.');
		tenantId = main.id;
	}
	let unitId: string;
	try {
		unitId = await createUnit(
			p,
			{
				tenantId,
				type: 'hub',
				name: a.name,
				title: null,
				isCentral: a.central,
				hidden: false,
				mayPostUrgent: null,
				mayCreateEvents: null,
				isKbb: false
			},
			ip
		);
	} catch (err) {
		if (err instanceof UnitError) throw new HubError(err.message);
		throw err;
	}
	await db.update(units).set({ about: a.description }).where(eq(units.id, unitId));
	// Hub-Team: bekannte Personen im Zuständigkeitsbereich
	const found = await db
		.select({ id: persons.id, email: persons.email, tenantId: persons.tenantId })
		.from(persons)
		.where(
			and(
				inArray(sql`lower(${persons.email})`, a.team),
				sql`${persons.status} <> 'disabled'`,
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
			)
		);
	const team = found.filter((f) => a.central || f.tenantId === tenantId);
	for (const t of team) {
		await db
			.insert(roleAssignments)
			.values({
				personId: t.id,
				role: 'hub_team',
				scope: 'unit',
				scopeUnitId: unitId,
				source: 'manual'
			})
			.onConflictDoNothing();
		await db.insert(unitMembers).values({ unitId, personId: t.id }).onConflictDoNothing();
		await db.insert(hubSubscriptions).values({ personId: t.id, unitId }).onConflictDoNothing();
	}
	await db
		.update(hubApplications)
		.set({ status: 'angelegt', unitId, endedAt: new Date() })
		.where(eq(hubApplications.id, id));
	const missing = a.team.filter((m) => !team.some((t) => t.email.toLowerCase() === m));
	const [u] = await db.select({ slug: units.slug }).from(units).where(eq(units.id, unitId));
	await informApplicant(
		a,
		p.personId,
		`Dein Hub „${a.name}“ ist angelegt: /hubs/${u.slug}` +
			(missing.length
				? `\nNicht gefunden für das Hub-Team: ${missing.join(', ')}. Die Verwaltung kann sie später ergänzen.`
				: '')
	);
	await audit({
		category: 'admin',
		action: 'hub.application_accept',
		actorId: p.personId,
		tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: { name: a.name, team: team.length },
		ip
	});
	return u.slug;
}

export async function rejectApplication(p: Principal, id: string, reason: string, ip: string) {
	const a = await reviewable(p, id, 'verwaltung');
	const text = reason.trim().slice(0, 1000);
	if (!text) throw new HubError('Gib bitte eine Begründung an.');
	await db
		.update(hubApplications)
		.set({ status: 'abgelehnt', decisionReason: text, endedAt: new Date() })
		.where(eq(hubApplications.id, id));
	await informApplicant(a, p.personId, `Dein Hub-Antrag wurde abgelehnt: ${text}`);
	await audit({
		category: 'admin',
		action: 'hub.application_reject',
		actorId: p.personId,
		tenantId: a.tenantId,
		entityType: 'hub_application',
		entityId: id,
		ip
	});
}

// ---------------------------------------------------------------------------
// Fristen (Kap. 8.12, 15)
// ---------------------------------------------------------------------------

/**
 * Ohne Antwort auf eine Rückfrage wird der Antrag nach 30 Tagen geschlossen;
 * abgelehnte/geschlossene Anträge nach 90 Tagen gelöscht; archivierte Hubs
 * nach 2 Jahren gelöscht.
 */
export async function hubRetention() {
	const answerDays = (await getContentRules()).hubAnswerDays;
	const waiting = await db.execute<{ ref_id: string; id: string }>(sql`
		select c.ref_id, c.id from conversations c
		join hub_applications a on a.id = c.ref_id and a.status in ('neu', 'bei_verwaltung')
		where c.kind = 'hub_antrag' and c.closed_at is null
		and (select m.as_role from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) = true
		and c.last_message_at < now() - make_interval(days => ${answerDays})`);
	for (const w of waiting) {
		await db
			.update(hubApplications)
			.set({
				status: 'geschlossen',
				decisionReason: 'Keine Antwort auf die Rückfrage',
				endedAt: new Date()
			})
			.where(eq(hubApplications.id, w.ref_id));
		await closeByRef(w.ref_id);
	}
	const keepDays = await getRetention('hub_applications_days');
	await db
		.delete(hubApplications)
		.where(
			and(
				inArray(hubApplications.status, ['abgelehnt', 'geschlossen', 'angelegt']),
				lt(hubApplications.endedAt, sql`now() - make_interval(days => ${keepDays})`)
			)
		);
	const years = await getRetention('archived_hubs_years');
	await db
		.delete(units)
		.where(
			and(
				eq(units.type, 'hub'),
				lt(units.archivedAt, sql`now() - make_interval(years => ${years})`)
			)
		);
}

/** Antwortfrist für die Anzeige im Gespräch (letzte Nachricht von der Rolle). */
export async function answerDeadline(conversationId: string): Promise<Date | null> {
	const [last] = await db
		.select({ asRole: messages.asRole, at: messages.createdAt })
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(desc(messages.createdAt))
		.limit(1);
	if (!last?.asRole) return null;
	const days = (await getContentRules()).hubAnswerDays;
	return new Date(last.at.getTime() + days * 86400_000);
}
