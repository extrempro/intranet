/**
 * Abteilungsseiten (Kap. 8.11): Geschäftsführung, Stabsstellen und
 * Abteilungen mit Kopf, „Wer hilft bei was?“, Team und Über uns.
 * Sichtbar sind Einheiten des eigenen Mandanten und zentrale Einheiten.
 * Gepflegt werden die Seiten von der Abteilungsverwaltung, bei Einheiten
 * ohne eigene Pflege von der Redaktion.
 */
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { addDays, berlinNow } from '../canteen.ts';
import {
	isReviewOverdue,
	reviewDue,
	validateResponsibility,
	type ResponsibilityErrors,
	type ResponsibilityInput
} from '../departments.ts';
import { unitTypeLabel } from '../roles.ts';
import { audit } from './audit.ts';
import {
	canAdministerTenant,
	canManageUnit,
	canWriteEvents,
	canWriteFaqs,
	canWriteNews,
	type Principal
} from './auth/access.ts';
import { db } from './db/index.ts';
import {
	events,
	faqs,
	persons,
	responsibilities,
	roleAssignments,
	tenants,
	unitMembers,
	units
} from './db/schema.ts';
import { notify } from './notify.ts';
import { getContentRules } from './rules.ts';
import { photosOf } from './people.ts';
import { hasOwnMaintenance } from './units.ts';

export class DepartmentError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEPARTMENT_TYPES = ['geschaeftsfuehrung', 'stabsstelle', 'abteilung'] as const;

/** Einheiten mit Abteilungsseite, die die Person sehen darf. */
function inScope(p: Principal) {
	return and(
		inArray(units.type, [...DEPARTMENT_TYPES]),
		isNull(units.archivedAt),
		or(eq(units.isCentral, true), eq(units.tenantId, p.tenantId))
	)!;
}

const active = sql`${persons.status} <> 'disabled'`;

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

export async function listDepartments(p: Principal) {
	const rows = await db
		.select({
			id: units.id,
			slug: units.slug,
			name: units.name,
			type: units.type,
			title: units.title,
			tagline: units.tagline,
			isCentral: units.isCentral,
			tenantShort: tenants.shortName
		})
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(and(inScope(p), eq(units.hidden, false)))
		.orderBy(asc(units.name));
	const ids = rows.map((r) => r.id);
	const [topics, counts] = ids.length
		? await Promise.all([
				responsibilityRows(ids),
				db
					.select({ unitId: unitMembers.unitId, n: sql<number>`count(*)::int` })
					.from(unitMembers)
					.innerJoin(persons, eq(persons.id, unitMembers.personId))
					.where(and(inArray(unitMembers.unitId, ids), active))
					.groupBy(unitMembers.unitId)
			])
		: [[], []];
	return rows.map((r) => ({
		...r,
		label: unitTypeLabel(r),
		personen: counts.find((c) => c.unitId === r.id)?.n ?? 0,
		zustaendigkeiten: topics
			.filter((t) => t.unitId === r.id)
			.map((t) => ({
				id: t.id,
				topic: t.topic,
				keywords: t.keywords,
				groupName: t.groupName,
				kontakt: contactOf(t)
			}))
	}));
}

/** Zuständigkeiten mit Ansprechperson und Vertretung (Name, Kontakt, Status). */
async function responsibilityRows(unitIds: string[]) {
	const rows = await db
		.select({
			id: responsibilities.id,
			unitId: responsibilities.unitId,
			topic: responsibilities.topic,
			description: responsibilities.description,
			keywords: responsibilities.keywords,
			groupName: responsibilities.groupName,
			links: responsibilities.links,
			position: responsibilities.position,
			personId: responsibilities.personId,
			deputyId: responsibilities.deputyId
		})
		.from(responsibilities)
		.where(inArray(responsibilities.unitId, unitIds))
		.orderBy(asc(responsibilities.position), asc(responsibilities.createdAt));
	const personIds = [
		...new Set(rows.flatMap((r) => [r.personId, r.deputyId]).filter((x): x is string => !!x))
	];
	const people = personIds.length
		? await db
				.select({
					id: persons.id,
					name: persons.displayName,
					email: persons.email,
					phone: persons.phone,
					room: persons.room,
					disabled: sql<boolean>`${persons.status} = 'disabled'`
				})
				.from(persons)
				.where(inArray(persons.id, personIds))
		: [];
	const byId = new Map(people.map((x) => [x.id, x]));
	return rows.map((r) => ({
		...r,
		person: r.personId ? (byId.get(r.personId) ?? null) : null,
		deputy: r.deputyId ? (byId.get(r.deputyId) ?? null) : null
	}));
}

type ResponsibilityRow = Awaited<ReturnType<typeof responsibilityRows>>[number];

/** Angezeigte Ansprechperson: ist sie inaktiv, die Vertretung (Kap. 8.11). */
function contactOf(r: ResponsibilityRow) {
	const pick = (x: ResponsibilityRow['person']) =>
		x ? { id: x.id, name: x.name, email: x.email, phone: x.phone, room: x.room } : null;
	if (r.person && !r.person.disabled) return { ...pick(r.person)!, vertretung: false };
	if (r.deputy && !r.deputy.disabled) return { ...pick(r.deputy)!, vertretung: true };
	return null;
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

async function loadUnit(p: Principal, slug: string) {
	if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
	const [row] = await db
		.select({ unit: units, tenantName: tenants.name, tenantShort: tenants.shortName })
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(and(eq(units.slug, slug), inScope(p)));
	return row ?? null;
}

export async function getDepartment(p: Principal, slug: string) {
	const row = await loadUnit(p, slug);
	if (!row) return null;
	const u = row.unit;
	const own = await hasOwnMaintenance(u.id);
	const canManage = canManageUnit(p, u, own);
	const canAdminister = canAdministerTenant(p, u.tenantId);
	const today = berlinNow().date;
	const { responsibilityReviewMonths: months } = await getContentRules();

	const [team, zust, termine, faqRows] = await Promise.all([
		teamOf(p, u.id),
		responsibilityRows([u.id]),
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
			.limit(5),
		db
			.select({ id: faqs.id, question: faqs.question })
			.from(faqs)
			.where(eq(faqs.unitId, u.id))
			.orderBy(asc(faqs.position), asc(faqs.createdAt))
			.limit(8)
	]);

	const leadIds = [u.leadPersonId, u.secondLeadPersonId, u.deputyPersonId].filter(
		(x): x is string => !!x
	);
	const leads = leadIds.length
		? await db
				.select({
					id: persons.id,
					name: persons.displayName,
					position: persons.position,
					email: persons.email
				})
				.from(persons)
				.where(and(inArray(persons.id, leadIds), active))
		: [];
	const lead = (id: string | null) => (id ? (leads.find((l) => l.id === id) ?? null) : null);

	const overdue = zust.length > 0 && isReviewOverdue(u.responsibilitiesCheckedAt, months);
	return {
		id: u.id,
		slug: u.slug,
		name: u.name,
		type: u.type,
		label: unitTypeLabel(u),
		isCentral: u.isCentral,
		hidden: u.hidden,
		tenantName: row.tenantName,
		tenantShort: row.tenantShort,
		about: u.about,
		tagline: u.tagline,
		kontakt: {
			email: u.contactEmail,
			telefon: u.contactPhone,
			sprechzeiten: u.officeHours,
			raum: u.room
		},
		leitung: lead(u.leadPersonId),
		zweiteLeitung: lead(u.secondLeadPersonId),
		stellvertretung: lead(u.deputyPersonId),
		team,
		zustaendigkeiten: zust.map((r) => ({
			id: r.id,
			topic: r.topic,
			description: r.description,
			keywords: r.keywords,
			groupName: r.groupName,
			links: r.links,
			kontakt: contactOf(r),
			// Nur für die Pflege: wer eingetragen ist, auch wenn inaktiv
			personId: canManage ? r.personId : null,
			deputyId: canManage ? r.deputyId : null,
			personInaktiv: canManage ? Boolean(r.person?.disabled) : false,
			deputyInaktiv: canManage ? Boolean(r.deputy?.disabled) : false
		})),
		termine,
		faqs: faqRows,
		canManage,
		canAdminister,
		canPost: canWriteNews(p, u),
		canEvents: canWriteEvents(p, u),
		canFaqs: canWriteFaqs(p, u),
		pruefung: {
			geprueftAm: u.responsibilitiesCheckedAt,
			faelligAm: reviewDue(u.responsibilitiesCheckedAt, months),
			ueberfaellig: overdue
		}
	};
}

/** Team mit Kontaktdaten; Mobil nach Sichtbarkeit (Kap. 8.13). */
async function teamOf(p: Principal, unitId: string) {
	const rows = await db
		.select({
			id: persons.id,
			name: persons.displayName,
			email: persons.email,
			position: persons.position,
			phone: persons.phone,
			mobile: persons.mobile,
			mobileVisibility: persons.mobileVisibility,
			room: persons.room
		})
		.from(unitMembers)
		.innerJoin(persons, eq(persons.id, unitMembers.personId))
		.where(and(eq(unitMembers.unitId, unitId), active))
		.orderBy(asc(persons.displayName));
	const viewerUnits = new Set(p.memberships.map((m) => m.unitId));
	const sameTeamPersons = new Set(
		viewerUnits.size
			? (
					await db
						.select({ personId: unitMembers.personId })
						.from(unitMembers)
						.where(inArray(unitMembers.unitId, [...viewerUnits]))
				).map((r) => r.personId)
			: []
	);
	const fotos = await photosOf(rows.map((r) => r.id));
	return rows.map(({ mobile, mobileVisibility, ...r }) => ({
		...r,
		foto: fotos.get(r.id) ?? null,
		mobile:
			mobile &&
			(r.id === p.personId ||
				mobileVisibility === 'all' ||
				(mobileVisibility === 'team' && sameTeamPersons.has(r.id)))
				? mobile
				: null
	}));
}

// ---------------------------------------------------------------------------
// Bearbeiten
// ---------------------------------------------------------------------------

/** Einheit zum Pflegen laden; ohne Recht wie „nicht gefunden“. */
async function manageable(p: Principal, unitId: string) {
	if (!GUID.test(unitId)) throw new DepartmentError('Einheit nicht gefunden.');
	const [u] = await db
		.select()
		.from(units)
		.where(and(eq(units.id, unitId), inScope(p)));
	if (!u) throw new DepartmentError('Einheit nicht gefunden.');
	const own = await hasOwnMaintenance(u.id);
	if (!canManageUnit(p, u, own) && !canAdministerTenant(p, u.tenantId))
		throw new DepartmentError('Dafür fehlt dir das Recht.');
	return u;
}

/** Daten für die Bearbeiten-Seite: Seite, Team mit Rechten, Zuständigkeiten. */
export async function getDepartmentForEdit(p: Principal, slug: string) {
	const row = await loadUnit(p, slug);
	if (!row) return null;
	const u = await manageable(p, row.unit.id).catch(() => null);
	if (!u) return null;
	const [team, managers, fach, zust] = await Promise.all([
		db
			.select({
				personId: persons.id,
				name: persons.displayName,
				email: persons.email,
				disabled: sql<boolean>`${persons.status} = 'disabled'`,
				isPrimary: unitMembers.isPrimary,
				mayWriteNews: unitMembers.mayWriteNews,
				mayWriteFaqs: unitMembers.mayWriteFaqs,
				mayWriteEvents: unitMembers.mayWriteEvents,
				mayWriteBehindScenes: unitMembers.mayWriteBehindScenes
			})
			.from(unitMembers)
			.innerJoin(persons, eq(persons.id, unitMembers.personId))
			.where(eq(unitMembers.unitId, u.id))
			.orderBy(asc(persons.displayName)),
		db
			.select({ personId: roleAssignments.personId })
			.from(roleAssignments)
			.where(
				and(eq(roleAssignments.scopeUnitId, u.id), eq(roleAssignments.role, 'abteilungsverwaltung'))
			),
		db
			.select({ personId: roleAssignments.personId })
			.from(roleAssignments)
			.where(and(eq(roleAssignments.scopeUnitId, u.id), eq(roleAssignments.role, 'fachpflege'))),
		responsibilityRows([u.id])
	]);
	const { writersMax } = await getContentRules();
	return {
		id: u.id,
		slug: u.slug,
		name: u.name,
		label: unitTypeLabel(u),
		about: u.about ?? '',
		tagline: u.tagline ?? '',
		contactEmail: u.contactEmail ?? '',
		contactPhone: u.contactPhone ?? '',
		officeHours: u.officeHours ?? '',
		room: u.room ?? '',
		leadPersonId: u.leadPersonId,
		secondLeadPersonId: u.secondLeadPersonId,
		deputyPersonId: u.deputyPersonId,
		behindScenes: u.behindScenes,
		isAdmin: canAdministerTenant(p, u.tenantId),
		maxSchreibende: writersMax,
		team: team.map((m) => ({
			...m,
			verwaltet: managers.some((r) => r.personId === m.personId),
			fachpflege: fach.some((r) => r.personId === m.personId)
		})),
		zustaendigkeiten: zust.map((r) => ({
			id: r.id,
			topic: r.topic,
			description: r.description ?? '',
			keywords: r.keywords,
			groupName: r.groupName ?? '',
			links: r.links,
			personId: r.personId,
			deputyId: r.deputyId,
			personName: r.person?.name ?? null,
			deputyName: r.deputy?.name ?? null,
			personInaktiv: Boolean(r.person?.disabled),
			deputyInaktiv: Boolean(r.deputy?.disabled)
		}))
	};
}

async function teamIds(unitId: string) {
	return new Set(
		(
			await db
				.select({ id: unitMembers.personId })
				.from(unitMembers)
				.where(eq(unitMembers.unitId, unitId))
		).map((r) => r.id)
	);
}

export async function updateDepartmentPage(
	p: Principal,
	unitId: string,
	input: {
		about: string;
		lead: string;
		secondLead: string;
		deputy: string;
		tagline: string;
		email: string;
		phone: string;
		hours: string;
		room: string;
	},
	ip: string
) {
	const u = await manageable(p, unitId);
	const team = await teamIds(u.id);
	const pick = (id: string, label: string) => {
		if (!id) return null;
		if (!GUID.test(id) || !team.has(id))
			throw new DepartmentError(`${label}: bitte eine Person aus dem Team wählen.`);
		return id;
	};
	const lead = pick(input.lead, 'Leitung');
	const secondLead = pick(input.secondLead, 'Zweite Leitung');
	const deputy = pick(input.deputy, 'Stellvertretung');
	const chosen = [lead, secondLead, deputy].filter(Boolean);
	if (new Set(chosen).size !== chosen.length)
		throw new DepartmentError('Eine Person kann nur eine dieser Aufgaben haben.');
	if (secondLead && !lead) throw new DepartmentError('Eine zweite Leitung braucht eine Leitung.');
	const about = input.about.trim();
	if (about.length > 3000) throw new DepartmentError('„Über uns“ hat höchstens 3000 Zeichen.');
	const kontakt = checkUnitContact(input);
	await db
		.update(units)
		.set({
			about: about || null,
			...kontakt,
			leadPersonId: lead,
			secondLeadPersonId: secondLead,
			deputyPersonId: deputy
		})
		.where(eq(units.id, u.id));
	await audit({
		category: 'admin',
		action: 'unit.page_update',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: u.id,
		details: { lead, secondLead, deputy },
		ip
	});
}

/** Kurzbeschreibung und Kontakt im Kopf der Abteilungsseite prüfen (alles freiwillig). */
export function checkUnitContact(input: {
	tagline: string;
	email: string;
	phone: string;
	hours: string;
	room: string;
}) {
	const t = (v: string, max: number, label: string) => {
		const x = v.trim().replace(/\s+/g, ' ');
		if (x.length > max) throw new DepartmentError(`${label} hat höchstens ${max} Zeichen.`);
		return x || null;
	};
	const tagline = t(input.tagline, 120, 'Die Kurzbeschreibung');
	const email = t(input.email, 254, 'Die Funktionsadresse');
	if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email))
		throw new DepartmentError('Die Funktionsadresse ist keine gültige E-Mail-Adresse.');
	const phone = t(input.phone, 40, 'Das Telefon');
	if (phone && !/^[0-9+()\-/ ]+$/.test(phone))
		throw new DepartmentError('Das Telefon darf nur Ziffern, Leerzeichen und + ( ) - / enthalten.');
	return {
		tagline,
		contactEmail: email?.toLowerCase() ?? null,
		contactPhone: phone,
		officeHours: t(input.hours, 120, 'Die Sprechzeiten'),
		room: t(input.room, 60, 'Der Raum')
	};
}

/** „Hinter den Kulissen“ für die Abteilung freischalten (Abteilungsverwaltung, Kap. 5.1). */
export async function setBehindScenes(p: Principal, unitId: string, on: boolean, ip: string) {
	const u = await manageable(p, unitId);
	await db.update(units).set({ behindScenes: on }).where(eq(units.id, u.id));
	await audit({
		category: 'admin',
		action: 'unit.behind_scenes',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: u.id,
		details: { on },
		ip
	});
}

// ---------------------------------------------------------------------------
// Zuständigkeiten
// ---------------------------------------------------------------------------

export class ResponsibilityValidationError extends Error {
	constructor(public errors: ResponsibilityErrors) {
		super('Bitte prüfe die markierten Felder.');
	}
}

async function cleanInput(unitId: string, input: ResponsibilityInput) {
	const { value, errors } = validateResponsibility(input);
	if (!value) throw new ResponsibilityValidationError(errors);
	const team = await teamIds(unitId);
	if (value.personId && !team.has(value.personId))
		throw new ResponsibilityValidationError({ personId: 'Bitte wähle eine Person aus dem Team.' });
	if (value.deputyId && !team.has(value.deputyId))
		throw new ResponsibilityValidationError({ deputyId: 'Bitte wähle eine Person aus dem Team.' });
	return value;
}

const MAX_RESPONSIBILITIES = 200;

export async function createResponsibility(
	p: Principal,
	unitId: string,
	input: ResponsibilityInput
) {
	const u = await manageable(p, unitId);
	const value = await cleanInput(u.id, input);
	const [{ n, max }] = await db
		.select({
			n: sql<number>`count(*)::int`,
			max: sql<number>`coalesce(max(${responsibilities.position}), -1)::int`
		})
		.from(responsibilities)
		.where(eq(responsibilities.unitId, u.id));
	if (n >= MAX_RESPONSIBILITIES)
		throw new DepartmentError(`Höchstens ${MAX_RESPONSIBILITIES} Zuständigkeiten je Einheit.`);
	await db.insert(responsibilities).values({ unitId: u.id, ...value, position: max + 1 });
	// Die erste Zuständigkeit startet den Prüfzeitraum
	if (!u.responsibilitiesCheckedAt)
		await db.update(units).set({ responsibilitiesCheckedAt: new Date() }).where(eq(units.id, u.id));
}

async function ownResponsibility(unitId: string, id: string) {
	if (!GUID.test(id)) throw new DepartmentError('Zuständigkeit nicht gefunden.');
	const [r] = await db
		.select({ id: responsibilities.id, position: responsibilities.position })
		.from(responsibilities)
		.where(and(eq(responsibilities.id, id), eq(responsibilities.unitId, unitId)));
	if (!r) throw new DepartmentError('Zuständigkeit nicht gefunden.');
	return r;
}

export async function updateResponsibility(
	p: Principal,
	unitId: string,
	id: string,
	input: ResponsibilityInput
) {
	const u = await manageable(p, unitId);
	await ownResponsibility(u.id, id);
	const value = await cleanInput(u.id, input);
	await db
		.update(responsibilities)
		.set(value)
		.where(and(eq(responsibilities.id, id), eq(responsibilities.unitId, u.id)));
}

export async function deleteResponsibility(p: Principal, unitId: string, id: string) {
	const u = await manageable(p, unitId);
	await ownResponsibility(u.id, id);
	await db
		.delete(responsibilities)
		.where(and(eq(responsibilities.id, id), eq(responsibilities.unitId, u.id)));
}

/** Eine Zuständigkeit nach oben oder unten schieben. */
export async function moveResponsibility(
	p: Principal,
	unitId: string,
	id: string,
	dir: 'hoch' | 'runter'
) {
	const u = await manageable(p, unitId);
	await ownResponsibility(u.id, id);
	await db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: responsibilities.id })
			.from(responsibilities)
			.where(eq(responsibilities.unitId, u.id))
			.orderBy(asc(responsibilities.position), asc(responsibilities.createdAt));
		const i = rows.findIndex((r) => r.id === id);
		const j = dir === 'hoch' ? i - 1 : i + 1;
		if (i < 0 || j < 0 || j >= rows.length) return;
		[rows[i], rows[j]] = [rows[j], rows[i]];
		for (const [pos, r] of rows.entries())
			await tx.update(responsibilities).set({ position: pos }).where(eq(responsibilities.id, r.id));
	});
}

/** „Alles geprüft“: Prüfzeitraum beginnt neu. */
export async function markReviewed(p: Principal, unitId: string, ip: string) {
	const u = await manageable(p, unitId);
	await db.update(units).set({ responsibilitiesCheckedAt: new Date() }).where(eq(units.id, u.id));
	await audit({
		category: 'admin',
		action: 'unit.responsibilities_reviewed',
		actorId: p.personId,
		tenantId: u.tenantId,
		entityType: 'unit',
		entityId: u.id,
		ip
	});
}

// ---------------------------------------------------------------------------
// Prüf-Erinnerung (läuft mit dem stündlichen Aufräumen)
// ---------------------------------------------------------------------------

/** Überfällige Zuständigkeiten: Abteilungsverwaltung bekommt einmal eine Erinnerung. */
export async function remindResponsibilityReviews() {
	const { responsibilityReviewMonths: months } = await getContentRules();
	const m = Math.max(1, Math.min(60, Math.round(months) || 12));
	const due = await db
		.select({ id: units.id, name: units.name, slug: units.slug })
		.from(units)
		.where(
			and(
				inArray(units.type, [...DEPARTMENT_TYPES]),
				isNull(units.archivedAt),
				isNotNull(units.responsibilitiesCheckedAt),
				lt(units.responsibilitiesCheckedAt, sql`now() - ${`${m} months`}::interval`),
				or(
					isNull(units.reviewRemindedAt),
					lt(units.reviewRemindedAt, units.responsibilitiesCheckedAt)
				),
				sql`exists (select 1 from responsibilities r where r.unit_id = ${units.id})`
			)
		);
	for (const u of due) {
		const managers = await db
			.selectDistinct({ id: roleAssignments.personId })
			.from(roleAssignments)
			.where(
				and(eq(roleAssignments.scopeUnitId, u.id), eq(roleAssignments.role, 'abteilungsverwaltung'))
			);
		await notify(
			'pflege',
			managers.map((x) => x.id),
			{
				title: `Zuständigkeiten prüfen: ${u.name}`,
				detail: `Seit ${m} Monaten nicht geprüft. Passt noch alles bei „Wer hilft bei was?“?`,
				link: `/abteilungen/${u.slug}`
			}
		);
		await db.update(units).set({ reviewRemindedAt: new Date() }).where(eq(units.id, u.id));
	}
}

/** Für die Redaktion: überfällige Prüfungen bei Einheiten ohne eigene Pflege. */
export async function overdueWithoutMaintenance(unitScope: ReturnType<typeof and>) {
	const { responsibilityReviewMonths: months } = await getContentRules();
	const m = Math.max(1, Math.min(60, Math.round(months) || 12));
	return db
		.select({
			id: units.id,
			name: units.name,
			slug: units.slug,
			checkedAt: units.responsibilitiesCheckedAt
		})
		.from(units)
		.where(
			and(
				unitScope,
				inArray(units.type, [...DEPARTMENT_TYPES]),
				isNotNull(units.responsibilitiesCheckedAt),
				lt(units.responsibilitiesCheckedAt, sql`now() - ${`${m} months`}::interval`),
				sql`exists (select 1 from responsibilities r where r.unit_id = ${units.id})`,
				sql`not exists (select 1 from role_assignments r where r.scope_unit_id = ${units.id} and r.role = 'abteilungsverwaltung')`
			)
		)
		.orderBy(asc(units.responsibilitiesCheckedAt));
}
