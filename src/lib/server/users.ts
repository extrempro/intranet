/**
 * Verwaltung → Benutzer und Rollen (Kap. 5, 14).
 * Rollen von Hand vergeben und entziehen, Konten sperren, Zuordnung
 * Entra-Gruppe → Rolle. Jede Funktion prüft das Recht selbst.
 */
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
	isValidRoleScope,
	ROLE_DEFINITIONS,
	ROLES,
	unitTypeLabel,
	type Role,
	type RoleScope,
	type UnitType
} from '../roles.ts';
import { audit } from './audit.ts';
import { removePhoto } from './people.ts';
import { canAdministerTenant, canGrantRole, isSystemAdmin, type Principal } from './auth/access.ts';
import { endAllSessions } from './auth/session.ts';
import { db } from './db/index.ts';
import {
	entraGroupRoles,
	localCredentials,
	persons,
	roleAssignments,
	tenants,
	units
} from './db/schema.ts';
import { administrableTenants } from './units.ts';

export class UserError extends Error {}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Personen
// ---------------------------------------------------------------------------

export async function listPersons(p: Principal, q: string) {
	const tenantIds = (await administrableTenants(p)).map((t) => t.id);
	if (tenantIds.length === 0) return [];
	const term = q.trim().slice(0, 100);
	const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	return db
		.select({
			id: persons.id,
			name: persons.displayName,
			email: persons.email,
			status: persons.status,
			authSource: persons.authSource,
			tenantName: tenants.name,
			roles: sql<number>`(select count(*)::int from role_assignments r where r.person_id = ${persons.id})`
		})
		.from(persons)
		.innerJoin(tenants, eq(tenants.id, persons.tenantId))
		.where(
			and(
				inArray(persons.tenantId, tenantIds),
				// Betreiber-Konten verwaltet Verwaltung → Standorte (Kap. 4.3)
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`,
				term ? or(ilike(persons.displayName, like), ilike(persons.email, like)) : undefined
			)
		)
		.orderBy(asc(persons.displayName))
		.limit(200);
}

async function loadPerson(p: Principal, id: string) {
	if (!GUID.test(id)) throw new UserError('Person nicht gefunden.');
	const [row] = await db
		.select({ person: persons, tenantName: tenants.name })
		.from(persons)
		.innerJoin(tenants, eq(tenants.id, persons.tenantId))
		.where(
			and(
				eq(persons.id, id),
				sql`not exists (select 1 from location_operators lo where lo.person_id = ${persons.id})`
			)
		);
	if (!row || !canAdministerTenant(p, row.person.tenantId))
		throw new UserError('Person nicht gefunden.');
	return row;
}

/** Lesbarer Geltungsbereich einer Rolle. */
async function scopeLabels(
	rows: { scope: RoleScope; scopeTenantId: string | null; scopeUnitId: string | null }[]
) {
	const tIds = [...new Set(rows.map((r) => r.scopeTenantId).filter((x): x is string => !!x))];
	const uIds = [...new Set(rows.map((r) => r.scopeUnitId).filter((x): x is string => !!x))];
	const [ts, us] = await Promise.all([
		tIds.length
			? db
					.select({ id: tenants.id, name: tenants.name })
					.from(tenants)
					.where(inArray(tenants.id, tIds))
			: [],
		uIds.length
			? db
					.select({ id: units.id, name: units.name, tenantId: units.tenantId })
					.from(units)
					.where(inArray(units.id, uIds))
			: []
	]);
	return (r: (typeof rows)[number]) => {
		if (r.scope === 'all') return { text: 'Alle Mandanten', tenantId: null };
		if (r.scope === 'tenant')
			return {
				text: ts.find((t) => t.id === r.scopeTenantId)?.name ?? '?',
				tenantId: r.scopeTenantId
			};
		const u = us.find((x) => x.id === r.scopeUnitId);
		return { text: u?.name ?? '?', tenantId: u?.tenantId ?? null };
	};
}

export async function getPerson(p: Principal, id: string) {
	const { person, tenantName } = await loadPerson(p, id);
	const assignments = await db
		.select()
		.from(roleAssignments)
		.where(eq(roleAssignments.personId, id))
		.orderBy(asc(roleAssignments.role));
	const label = await scopeLabels(assignments);
	const roles = assignments.map((a) => {
		const s = label(a);
		return {
			id: a.id,
			role: a.role,
			roleLabel: ROLE_DEFINITIONS[a.role].label,
			scopeText: s.text,
			source: a.source,
			mayRevoke:
				a.source === 'manual' &&
				canGrantRole(p, { role: a.role, scope: a.scope, tenantId: s.tenantId })
		};
	});

	// Auswahl für „Rolle vergeben“
	const tenantOptions = await administrableTenants(p);
	const unitRows = tenantOptions.length
		? await db
				.select({
					id: units.id,
					name: units.name,
					type: units.type,
					title: units.title,
					tenantId: units.tenantId,
					tenantName: tenants.name
				})
				.from(units)
				.innerJoin(tenants, eq(tenants.id, units.tenantId))
				.where(
					inArray(
						units.tenantId,
						tenantOptions.map((t) => t.id)
					)
				)
				.orderBy(asc(units.name))
		: [];
	const roleOptions = ROLES.filter((role) =>
		ROLE_DEFINITIONS[role].scopes.some((scope) =>
			scope === 'all'
				? canGrantRole(p, { role, scope, tenantId: null })
				: tenantOptions.some((t) => canGrantRole(p, { role, scope, tenantId: t.id }))
		)
	).map((role) => ({
		role,
		label: ROLE_DEFINITIONS[role].label,
		scopes: ROLE_DEFINITIONS[role].scopes.filter((scope) =>
			scope === 'all' ? canGrantRole(p, { role, scope, tenantId: null }) : true
		),
		unitTypes: [...(ROLE_DEFINITIONS[role].unitTypes ?? [])]
	}));

	const [cred] =
		person.authSource === 'local'
			? await db
					.select({ hasPassword: sql<boolean>`${localCredentials.passwordHash} is not null` })
					.from(localCredentials)
					.where(eq(localCredentials.personId, id))
			: [];

	return {
		id: person.id,
		name: person.displayName,
		email: person.email,
		status: person.status,
		authSource: person.authSource,
		lastLoginAt: person.lastLoginAt,
		tenantName,
		ich: person.id === p.personId,
		einladungOffen: person.authSource === 'local' && !cred?.hasPassword,
		roles,
		roleOptions,
		tenantOptions: tenantOptions.map((t) => ({ id: t.id, name: t.name })),
		unitOptions: unitRows.map((u) => ({
			id: u.id,
			name: u.name,
			type: u.type,
			label: unitTypeLabel(u),
			tenantName: u.tenantName
		}))
	};
}

export interface GrantInput {
	role: string;
	scope: string;
	scopeId: string;
}

/** Prüft Rolle und Geltungsbereich und liefert die Spalten für role_assignments/entra_group_roles. */
async function resolveGrant(p: Principal, input: GrantInput) {
	if (!(ROLES as readonly string[]).includes(input.role)) throw new UserError('Unbekannte Rolle.');
	const role = input.role as Role;
	const scope = input.scope as RoleScope;
	if (!['all', 'tenant', 'unit'].includes(scope))
		throw new UserError('Unbekannter Geltungsbereich.');

	let scopeTenantId: string | null = null;
	let scopeUnitId: string | null = null;
	let unitType: UnitType | undefined;
	let tenantForCheck: string | null = null;

	if (scope === 'tenant') {
		if (!GUID.test(input.scopeId)) throw new UserError('Wähle bitte einen Mandanten.');
		const [t] = await db
			.select({ id: tenants.id })
			.from(tenants)
			.where(eq(tenants.id, input.scopeId));
		if (!t) throw new UserError('Mandant nicht gefunden.');
		scopeTenantId = t.id;
		tenantForCheck = t.id;
	} else if (scope === 'unit') {
		if (!GUID.test(input.scopeId)) throw new UserError('Wähle bitte eine Einheit.');
		const [u] = await db
			.select({ id: units.id, type: units.type, tenantId: units.tenantId })
			.from(units)
			.where(eq(units.id, input.scopeId));
		if (!u) throw new UserError('Einheit nicht gefunden.');
		scopeUnitId = u.id;
		unitType = u.type;
		tenantForCheck = u.tenantId;
	}

	if (!isValidRoleScope(role, scope, unitType)) {
		throw new UserError(`„${ROLE_DEFINITIONS[role].label}“ passt nicht zu diesem Geltungsbereich.`);
	}
	if (!canGrantRole(p, { role, scope, tenantId: tenantForCheck })) {
		throw new UserError('Diese Rolle darfst du hier nicht vergeben.');
	}
	return { role, scope, scopeTenantId, scopeUnitId };
}

export async function grantRole(p: Principal, personId: string, input: GrantInput, ip: string) {
	const { person } = await loadPerson(p, personId);
	const g = await resolveGrant(p, input);
	const inserted = await db
		.insert(roleAssignments)
		.values({ personId, ...g, source: 'manual', createdBy: p.personId })
		.onConflictDoNothing()
		.returning({ id: roleAssignments.id });
	if (!inserted.length) throw new UserError('Diese Rolle hat die Person schon.');
	await audit({
		category: 'admin',
		action: 'role.grant',
		actorId: p.personId,
		tenantId: person.tenantId,
		entityType: 'person',
		entityId: personId,
		details: g,
		ip
	});
}

export async function revokeRole(p: Principal, personId: string, assignmentId: string, ip: string) {
	const { person } = await loadPerson(p, personId);
	if (!GUID.test(assignmentId)) throw new UserError('Rolle nicht gefunden.');
	const [a] = await db
		.select()
		.from(roleAssignments)
		.where(and(eq(roleAssignments.id, assignmentId), eq(roleAssignments.personId, personId)));
	if (!a) throw new UserError('Rolle nicht gefunden.');
	if (a.source !== 'manual')
		throw new UserError('Rollen aus Entra-Gruppen werden in Entra verwaltet.');
	const label = await scopeLabels([a]);
	if (!canGrantRole(p, { role: a.role, scope: a.scope, tenantId: label(a).tenantId })) {
		throw new UserError('Diese Rolle darfst du nicht entziehen.');
	}
	if (a.role === 'system_admin' && personId === p.personId) {
		throw new UserError('Deine eigene System-Admin-Rolle kannst du nicht entziehen.');
	}
	await db.delete(roleAssignments).where(eq(roleAssignments.id, assignmentId));
	await audit({
		category: 'admin',
		action: 'role.revoke',
		actorId: p.personId,
		tenantId: person.tenantId,
		entityType: 'person',
		entityId: personId,
		details: {
			role: a.role,
			scope: a.scope,
			scopeTenantId: a.scopeTenantId,
			scopeUnitId: a.scopeUnitId
		},
		ip
	});
}

/** Konto sperren oder wieder freigeben. Sperren beendet alle Sitzungen sofort. */
export async function setPersonActive(p: Principal, personId: string, active: boolean, ip: string) {
	const { person } = await loadPerson(p, personId);
	if (personId === p.personId) throw new UserError('Dein eigenes Konto kannst du nicht sperren.');
	if (active) {
		let status: 'active' | 'invited' = 'active';
		if (person.authSource === 'local') {
			const [c] = await db
				.select({ hash: localCredentials.passwordHash })
				.from(localCredentials)
				.where(eq(localCredentials.personId, personId));
			if (!c?.hash) status = 'invited';
		}
		await db
			.update(persons)
			.set({ status, disabledAt: null, disabledBy: null })
			.where(eq(persons.id, personId));
	} else {
		await db
			.update(persons)
			.set({ status: 'disabled', disabledAt: new Date(), disabledBy: 'verwaltung' })
			.where(eq(persons.id, personId));
		await endAllSessions(personId);
		// Profilfoto sofort löschen (Kap. 15)
		await removePhoto(personId);
	}
	await audit({
		category: 'admin',
		action: active ? 'person.enable' : 'person.disable',
		actorId: p.personId,
		tenantId: person.tenantId,
		entityType: 'person',
		entityId: personId,
		ip
	});
}

// ---------------------------------------------------------------------------
// Entra-Gruppe → Rolle (nur System-Admins)
// ---------------------------------------------------------------------------

function requireSystemAdmin(p: Principal) {
	if (!isSystemAdmin(p)) throw new UserError('Das dürfen nur System-Admins.');
}

export async function listGroupMappings(p: Principal) {
	requireSystemAdmin(p);
	const rows = await db
		.select()
		.from(entraGroupRoles)
		.orderBy(asc(entraGroupRoles.groupName), asc(entraGroupRoles.groupId));
	const label = await scopeLabels(rows);
	return rows.map((r) => ({
		id: r.id,
		groupId: r.groupId,
		groupName: r.groupName,
		roleLabel: ROLE_DEFINITIONS[r.role].label,
		scopeText: label(r).text
	}));
}

export async function addGroupMapping(
	p: Principal,
	groupId: string,
	groupName: string,
	input: GrantInput,
	ip: string
) {
	requireSystemAdmin(p);
	const id = groupId.trim();
	if (!GUID.test(id)) throw new UserError('Die Gruppen-ID ist die Objekt-ID aus Entra (GUID).');
	const g = await resolveGrant(p, input);
	const inserted = await db
		.insert(entraGroupRoles)
		.values({ groupId: id.toLowerCase(), groupName: groupName.trim().slice(0, 120) || null, ...g })
		.onConflictDoNothing()
		.returning({ id: entraGroupRoles.id });
	if (!inserted.length) throw new UserError('Diese Zuordnung gibt es schon.');
	await audit({
		category: 'admin',
		action: 'entra_group_role.add',
		actorId: p.personId,
		entityType: 'entra_group_role',
		entityId: inserted[0].id,
		details: { groupId: id, ...g },
		ip
	});
}

export async function removeGroupMapping(p: Principal, mappingId: string, ip: string) {
	requireSystemAdmin(p);
	if (!GUID.test(mappingId)) throw new UserError('Zuordnung nicht gefunden.');
	const removed = await db
		.delete(entraGroupRoles)
		.where(eq(entraGroupRoles.id, mappingId))
		.returning();
	if (removed.length) {
		await audit({
			category: 'admin',
			action: 'entra_group_role.remove',
			actorId: p.personId,
			entityType: 'entra_group_role',
			entityId: mappingId,
			details: { groupId: removed[0].groupId, role: removed[0].role },
			ip
		});
	}
}
