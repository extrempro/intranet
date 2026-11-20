/**
 * Einheiten verwalten (Kap. 3.2, 5.2, 14) – schlichte Verwaltung für Etappe 1.
 * Läuft mit der Besitzer-Verbindung; jede Funktion prüft das Recht selbst.
 */
import { and, asc, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { isValidRoleScope, type UnitType } from '../roles.ts';
import { slugify } from '../slug.ts';
import { audit } from './audit.ts';
import { canAdministerTenant, canManageUnit, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import { persons, roleAssignments, tenants, unitMembers, units } from './db/schema.ts';
import { getContentRules } from './rules.ts';

export const UNIT_TYPES: UnitType[] = ['geschaeftsfuehrung', 'stabsstelle', 'abteilung', 'hub'];

export class UnitError extends Error {}

/** Mandanten, die die Person verwalten darf. */
export async function administrableTenants(p: Principal) {
	const rows = await db
		.select({ id: tenants.id, name: tenants.name, isMain: tenants.isMain })
		.from(tenants)
		.orderBy(asc(tenants.name));
	return rows.filter((t) => canAdministerTenant(p, t.id));
}

export async function listUnits(p: Principal) {
	const tenantIds = (await administrableTenants(p)).map((t) => t.id);
	if (tenantIds.length === 0) return [];
	const rows = await db
		.select({
			id: units.id,
			name: units.name,
			type: units.type,
			title: units.title,
			isCentral: units.isCentral,
			hidden: units.hidden,
			tenantName: tenants.name,
			members: sql<number>`(select count(*)::int from unit_members m where m.unit_id = ${units.id})`,
			managers: sql<number>`(select count(*)::int from role_assignments r where r.scope_unit_id = ${units.id} and r.role in ('abteilungsverwaltung', 'hub_team'))`
		})
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(inArray(units.tenantId, tenantIds))
		.orderBy(asc(units.type), asc(units.name));
	return rows;
}

async function loadForAdmin(p: Principal, unitId: string) {
	const [unit] = await db
		.select({
			unit: units,
			tenantIsMain: tenants.isMain,
			tenantName: tenants.name,
			kbbUnitId: tenants.kbbUnitId
		})
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(eq(units.id, unitId));
	if (!unit || !canAdministerTenant(p, unit.unit.tenantId))
		throw new UnitError('Einheit nicht gefunden.');
	return unit;
}

/** Eigene Pflege: mindestens eine Person mit Abteilungsverwaltung bzw. Hub-Team. */
export async function hasOwnMaintenance(unitId: string): Promise<boolean> {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(roleAssignments)
		.where(
			and(
				eq(roleAssignments.scopeUnitId, unitId),
				inArray(roleAssignments.role, ['abteilungsverwaltung', 'hub_team'])
			)
		);
	return (row?.n ?? 0) > 0;
}

/**
 * Team und Schreibrechte pflegen: Verwaltung des Mandanten oder die Pflege
 * der Einheit (Abteilungsverwaltung, Hub-Team, Redaktion bei Einheiten ohne
 * eigene Pflege). Die Pflege-Rolle selbst vergibt nur die Verwaltung.
 */
async function loadForTeam(p: Principal, unitId: string) {
	const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!GUID.test(unitId)) throw new UnitError('Einheit nicht gefunden.');
	const [row] = await db
		.select({ unit: units, kbbUnitId: tenants.kbbUnitId })
		.from(units)
		.innerJoin(tenants, eq(tenants.id, units.tenantId))
		.where(eq(units.id, unitId));
	if (!row) throw new UnitError('Einheit nicht gefunden.');
	const admin = canAdministerTenant(p, row.unit.tenantId);
	if (!admin && !canManageUnit(p, row.unit, await hasOwnMaintenance(unitId)))
		throw new UnitError('Einheit nicht gefunden.');
	return { ...row, admin };
}

async function isManagerOf(unitId: string, personId: string) {
	const [r] = await db
		.select({ id: roleAssignments.id })
		.from(roleAssignments)
		.where(
			and(
				eq(roleAssignments.scopeUnitId, unitId),
				eq(roleAssignments.personId, personId),
				inArray(roleAssignments.role, ['abteilungsverwaltung', 'hub_team'])
			)
		);
	return Boolean(r);
}

export async function getUnitForAdmin(p: Principal, unitId: string) {
	const u = await loadForAdmin(p, unitId);
	const team = await db
		.select({
			personId: persons.id,
			name: persons.displayName,
			email: persons.email,
			isPrimary: unitMembers.isPrimary,
			mayWriteNews: unitMembers.mayWriteNews,
			mayWriteFaqs: unitMembers.mayWriteFaqs,
			mayWriteEvents: unitMembers.mayWriteEvents,
			mayWriteBehindScenes: unitMembers.mayWriteBehindScenes
		})
		.from(unitMembers)
		.innerJoin(persons, eq(persons.id, unitMembers.personId))
		.where(eq(unitMembers.unitId, unitId))
		.orderBy(asc(persons.displayName));
	const managers = await db
		.select({ personId: roleAssignments.personId, source: roleAssignments.source })
		.from(roleAssignments)
		.where(
			and(
				eq(roleAssignments.scopeUnitId, unitId),
				inArray(roleAssignments.role, ['abteilungsverwaltung', 'hub_team'])
			)
		);
	const fach = await db
		.select({ personId: roleAssignments.personId, source: roleAssignments.source })
		.from(roleAssignments)
		.where(and(eq(roleAssignments.scopeUnitId, unitId), eq(roleAssignments.role, 'fachpflege')));
	return {
		...u.unit,
		tenantName: u.tenantName,
		tenantIsMain: u.tenantIsMain,
		isKbb: u.kbbUnitId === unitId,
		team: team.map((m) => ({
			...m,
			verwaltet: managers.some((r) => r.personId === m.personId),
			ausEntra: managers.some((r) => r.personId === m.personId && r.source === 'entra'),
			fachpflege: fach.some((r) => r.personId === m.personId),
			fachpflegeAusEntra: fach.some((r) => r.personId === m.personId && r.source === 'entra')
		}))
	};
}

export interface UnitInput {
	tenantId: string;
	type: UnitType;
	name: string;
	title: string | null;
	isCentral: boolean;
	hidden: boolean;
	mayPostUrgent: boolean | null;
	mayCreateEvents: boolean | null;
	isKbb: boolean;
	/** Nur Hubs */
	mandatorySubscription?: boolean;
	/** Hinter den Kulissen freigeschaltet (nicht für Hubs) */
	behindScenes?: boolean;
}

async function checkInput(p: Principal, input: UnitInput) {
	if (!UNIT_TYPES.includes(input.type)) throw new UnitError('Unbekannter Typ.');
	const name = input.name.trim();
	if (name.length < 2 || name.length > 120)
		throw new UnitError('Der Name braucht 2 bis 120 Zeichen.');
	if (!canAdministerTenant(p, input.tenantId))
		throw new UnitError('Für diesen Mandanten fehlt dir das Recht.');
	const [tenant] = await db
		.select({ isMain: tenants.isMain })
		.from(tenants)
		.where(eq(tenants.id, input.tenantId));
	if (!tenant) throw new UnitError('Mandant nicht gefunden.');
	const central = input.type === 'stabsstelle' ? true : input.isCentral;
	if (central && !tenant.isMain) {
		throw new UnitError('Zentrale Einheiten und Stabsstellen gehören zum Hauptmandanten.');
	}
	const title =
		input.type === 'geschaeftsfuehrung' || input.type === 'stabsstelle'
			? input.title?.trim().slice(0, 80) || null
			: null;
	return { name, title, central };
}

async function uniqueSlug(name: string, exceptId?: string): Promise<string> {
	const base = slugify(name) || 'einheit';
	for (let i = 1; i < 100; i++) {
		const slug = i === 1 ? base : `${base}-${i}`;
		const [hit] = await db
			.select({ id: units.id })
			.from(units)
			.where(exceptId ? and(eq(units.slug, slug), ne(units.id, exceptId)) : eq(units.slug, slug));
		if (!hit) return slug;
	}
	throw new UnitError('Kein freies Adresskürzel gefunden.');
}

async function setKbb(tenantId: string, unitId: string, isKbb: boolean) {
	if (isKbb) await db.update(tenants).set({ kbbUnitId: unitId }).where(eq(tenants.id, tenantId));
	else
		await db
			.update(tenants)
			.set({ kbbUnitId: null })
			.where(and(eq(tenants.id, tenantId), eq(tenants.kbbUnitId, unitId)));
}

export async function createUnit(p: Principal, input: UnitInput, ip: string): Promise<string> {
	const { name, title, central } = await checkInput(p, input);
	const [row] = await db
		.insert(units)
		.values({
			tenantId: input.tenantId,
			type: input.type,
			name,
			title,
			slug: await uniqueSlug(name),
			isCentral: central,
			hidden: input.hidden,
			mayPostUrgent: input.mayPostUrgent,
			mayCreateEvents: input.mayCreateEvents,
			mandatorySubscription: input.type === 'hub' && Boolean(input.mandatorySubscription),
			behindScenes: input.type !== 'hub' && Boolean(input.behindScenes)
		})
		.returning({ id: units.id });
	if (input.type === 'abteilung') await setKbb(input.tenantId, row.id, input.isKbb);
	await audit({
		category: 'admin',
		action: 'unit.create',
		actorId: p.personId,
		tenantId: input.tenantId,
		entityType: 'unit',
		entityId: row.id,
		details: { type: input.type, name, central },
		ip
	});
	return row.id;
}

export async function updateUnit(p: Principal, unitId: string, input: UnitInput, ip: string) {
	const current = await loadForAdmin(p, unitId);
	if (current.unit.tenantId !== input.tenantId || current.unit.type !== input.type) {
		// Typ und Mandant legt die Verwaltung beim Anlegen fest (Kap. 3.2)
		throw new UnitError('Typ und Mandant lassen sich nicht ändern.');
	}
	const { name, title, central } = await checkInput(p, input);
	await db
		.update(units)
		.set({
			name,
			title,
			isCentral: central,
			hidden: input.hidden,
			mayPostUrgent: input.mayPostUrgent,
			mayCreateEvents: input.mayCreateEvents,
			mandatorySubscription: input.type === 'hub' && Boolean(input.mandatorySubscription),
			behindScenes: input.type !== 'hub' && Boolean(input.behindScenes)
		})
		.where(eq(units.id, unitId));
	if (input.type === 'abteilung') await setKbb(input.tenantId, unitId, input.isKbb);
	await audit({
		category: 'admin',
		action: 'unit.update',
		actorId: p.personId,
		tenantId: input.tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: {
			name,
			central,
			hidden: input.hidden,
			mayPostUrgent: input.mayPostUrgent,
			mayCreateEvents: input.mayCreateEvents,
			mandatorySubscription: input.mandatorySubscription,
			kbb: input.isKbb
		},
		ip
	});
}

// ---------------------------------------------------------------------------
// Team und Schreibrechte
// ---------------------------------------------------------------------------

export async function addMember(p: Principal, unitId: string, email: string, ip: string) {
	const u = await loadForTeam(p, unitId);
	const [person] = await db
		.select({ id: persons.id, tenantId: persons.tenantId })
		.from(persons)
		.where(
			and(
				sql`lower(${persons.email}) = lower(${email.trim()})`,
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
			)
		);
	// Gleiche Meldung für „gibt es nicht“ und „anderer Mandant“
	if (!person || person.tenantId !== u.unit.tenantId) {
		throw new UnitError('Keine Person mit dieser E-Mail-Adresse in diesem Mandanten.');
	}
	await db.insert(unitMembers).values({ unitId, personId: person.id }).onConflictDoNothing();
	await audit({
		category: 'admin',
		action: 'unit.member_add',
		actorId: p.personId,
		tenantId: u.unit.tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: { personId: person.id },
		ip
	});
}

export async function removeMember(p: Principal, unitId: string, personId: string, ip: string) {
	const u = await loadForTeam(p, unitId);
	if (!u.admin && (await isManagerOf(unitId, personId)))
		throw new UnitError('Personen mit Pflege-Rolle entfernt nur die Verwaltung.');
	await db
		.delete(unitMembers)
		.where(and(eq(unitMembers.unitId, unitId), eq(unitMembers.personId, personId)));
	await db
		.delete(roleAssignments)
		.where(
			and(
				eq(roleAssignments.personId, personId),
				eq(roleAssignments.scopeUnitId, unitId),
				eq(roleAssignments.source, 'manual')
			)
		);
	await audit({
		category: 'admin',
		action: 'unit.member_remove',
		actorId: p.personId,
		tenantId: u.unit.tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: { personId },
		ip
	});
}

export interface MemberRights {
	isPrimary: boolean;
	mayWriteNews: boolean;
	mayWriteFaqs: boolean;
	mayWriteEvents: boolean;
	mayWriteBehindScenes: boolean;
	verwaltet: boolean;
	/** Nur beim KBB: Pläne hochladen und löschen (Kap. 8.6). */
	fachpflege?: boolean;
}

/** Schreibrechte, eigene Abteilung und Verwaltung der Einheit für eine Person. */
export async function setMemberRights(
	p: Principal,
	unitId: string,
	personId: string,
	r: MemberRights,
	ip: string
) {
	const u = await loadForTeam(p, unitId);
	const isHub = u.unit.type === 'hub';
	const rights = {
		mayWriteNews: r.mayWriteNews,
		mayWriteFaqs: r.mayWriteFaqs,
		mayWriteEvents: r.mayWriteEvents,
		// Hubs haben kein „Hinter den Kulissen“ (Kap. 5.2)
		mayWriteBehindScenes: isHub ? false : r.mayWriteBehindScenes
	};
	const writes = Object.values(rights).some(Boolean);
	// Die Pflege-Rolle und Fachpflege vergibt nur die Verwaltung
	if (!u.admin) {
		r = { ...r, verwaltet: await isManagerOf(unitId, personId), fachpflege: undefined };
	}
	const role = isHub ? 'hub_team' : 'abteilungsverwaltung';
	if (!isValidRoleScope(role, 'unit', u.unit.type)) throw new UnitError('Ungültige Rolle.');

	await db.transaction(async (tx) => {
		const [member] = await tx
			.select({ id: unitMembers.personId })
			.from(unitMembers)
			.where(and(eq(unitMembers.unitId, unitId), eq(unitMembers.personId, personId)));
		if (!member) throw new UnitError('Die Person gehört nicht zum Team.');

		// Höchstzahl Schreibender; Verwaltung zählt nicht mit (Kap. 5.2)
		if (writes && !r.verwaltet) {
			const { writersMax } = await getContentRules();
			const managers = (
				await tx
					.select({ personId: roleAssignments.personId })
					.from(roleAssignments)
					.where(and(eq(roleAssignments.scopeUnitId, unitId), eq(roleAssignments.role, role)))
			).map((x) => x.personId);
			const [{ n }] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(unitMembers)
				.where(
					and(
						eq(unitMembers.unitId, unitId),
						ne(unitMembers.personId, personId),
						or(
							unitMembers.mayWriteNews,
							unitMembers.mayWriteFaqs,
							unitMembers.mayWriteEvents,
							unitMembers.mayWriteBehindScenes
						),
						managers.length ? notInArray(unitMembers.personId, managers) : undefined
					)
				);
			if (n >= writersMax)
				throw new UnitError(`Höchstens ${writersMax} Personen mit Schreibrecht je Einheit.`);
		}

		if (r.isPrimary) {
			await tx
				.update(unitMembers)
				.set({ isPrimary: false })
				.where(and(eq(unitMembers.personId, personId), ne(unitMembers.unitId, unitId)));
		}
		await tx
			.update(unitMembers)
			.set({ ...rights, isPrimary: r.isPrimary })
			.where(and(eq(unitMembers.unitId, unitId), eq(unitMembers.personId, personId)));

		if (u.kbbUnitId === unitId && r.fachpflege !== undefined) {
			const fp = and(
				eq(roleAssignments.personId, personId),
				eq(roleAssignments.scopeUnitId, unitId),
				eq(roleAssignments.role, 'fachpflege'),
				eq(roleAssignments.source, 'manual')
			);
			const [hasFp] = await tx.select({ id: roleAssignments.id }).from(roleAssignments).where(fp);
			if (r.fachpflege && !hasFp)
				await tx.insert(roleAssignments).values({
					personId,
					role: 'fachpflege',
					scope: 'unit',
					scopeUnitId: unitId,
					createdBy: p.personId
				});
			if (!r.fachpflege && hasFp) await tx.delete(roleAssignments).where(fp);
		}

		const manual = and(
			eq(roleAssignments.personId, personId),
			eq(roleAssignments.scopeUnitId, unitId),
			eq(roleAssignments.role, role),
			eq(roleAssignments.source, 'manual')
		);
		if (!u.admin) return;
		if (r.verwaltet) {
			const [has] = await tx.select({ id: roleAssignments.id }).from(roleAssignments).where(manual);
			if (!has)
				await tx
					.insert(roleAssignments)
					.values({ personId, role, scope: 'unit', scopeUnitId: unitId, createdBy: p.personId });
		} else {
			await tx.delete(roleAssignments).where(manual);
		}
	});
	await audit({
		category: 'admin',
		action: 'unit.member_rights',
		actorId: p.personId,
		tenantId: u.unit.tenantId,
		entityType: 'unit',
		entityId: unitId,
		details: {
			personId,
			...rights,
			isPrimary: r.isPrimary,
			verwaltet: r.verwaltet,
			fachpflege: r.fachpflege
		},
		ip
	});
}
