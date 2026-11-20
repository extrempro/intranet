/**
 * Zentrale Rechteprüfung (Kap. 2, 5, 16). Alles hier ist rein und getestet;
 * geladen wird der Principal einmal je Anfrage im Hook (locals.principal).
 *
 * Die Mandantentrennung gilt doppelt: hier im Code und zusätzlich per
 * Row-Level Security in PostgreSQL (siehe db/index.ts, scoped()).
 */
import { eq } from 'drizzle-orm';
import type { Role } from '../../roles.ts';
import { db } from '../db/index.ts';
import { roleAssignments, unitMembers } from '../db/schema.ts';

export interface RoleGrant {
	role: Role;
	scope: 'all' | 'tenant' | 'unit';
	scopeTenantId: string | null;
	scopeUnitId: string | null;
}

export interface Membership {
	unitId: string;
	isPrimary: boolean;
	mayWriteNews: boolean;
	mayWriteFaqs: boolean;
	mayWriteEvents: boolean;
	mayWriteBehindScenes: boolean;
}

export interface Principal {
	personId: string;
	tenantId: string;
	roles: RoleGrant[];
	memberships: Membership[];
}

/** Die für Rechte nötigen Angaben einer Einheit. */
export interface UnitRef {
	id: string;
	tenantId: string;
	isCentral: boolean;
}

export async function loadPrincipal(person: { id: string; tenantId: string }): Promise<Principal> {
	const [roles, memberships] = await Promise.all([
		db
			.select({
				role: roleAssignments.role,
				scope: roleAssignments.scope,
				scopeTenantId: roleAssignments.scopeTenantId,
				scopeUnitId: roleAssignments.scopeUnitId
			})
			.from(roleAssignments)
			.where(eq(roleAssignments.personId, person.id)),
		db
			.select({
				unitId: unitMembers.unitId,
				isPrimary: unitMembers.isPrimary,
				mayWriteNews: unitMembers.mayWriteNews,
				mayWriteFaqs: unitMembers.mayWriteFaqs,
				mayWriteEvents: unitMembers.mayWriteEvents,
				mayWriteBehindScenes: unitMembers.mayWriteBehindScenes
			})
			.from(unitMembers)
			.where(eq(unitMembers.personId, person.id))
	]);
	return { personId: person.id, tenantId: person.tenantId, roles, memberships };
}

// ---------------------------------------------------------------------------
// Rollen
// ---------------------------------------------------------------------------

export function isSystemAdmin(p: Principal): boolean {
	return p.roles.some((r) => r.role === 'system_admin');
}

/** Rolle mit Geltungsbereich „alle“ oder für genau diesen Mandanten. */
export function hasTenantRole(p: Principal, role: Role, tenantId: string): boolean {
	return p.roles.some(
		(r) =>
			r.role === role &&
			(r.scope === 'all' || (r.scope === 'tenant' && r.scopeTenantId === tenantId))
	);
}

export function hasUnitRole(p: Principal, role: Role, unitId: string): boolean {
	return p.roles.some((r) => r.role === role && r.scope === 'unit' && r.scopeUnitId === unitId);
}

/** Mandanten-Admin dieses Mandanten oder System-Admin. */
export function canAdministerTenant(p: Principal, tenantId: string): boolean {
	return isSystemAdmin(p) || hasTenantRole(p, 'mandanten_admin', tenantId);
}

/** Zugang zur Verwaltung überhaupt (Kap. 14). */
export function canSeeAdministration(p: Principal): boolean {
	return p.roles.some((r) => r.role === 'system_admin' || r.role === 'mandanten_admin');
}

/** Redaktion für den Mandanten der Person oder für alle (Kap. 10). */
export function isEditorial(p: Principal, tenantId = p.tenantId): boolean {
	return hasTenantRole(p, 'redaktion', tenantId);
}

// ---------------------------------------------------------------------------
// Mandantentrennung
// ---------------------------------------------------------------------------

/** Einheiten des eigenen Mandanten und zentrale Einheiten (Grundprinzip 3). */
export function canSeeUnit(p: Principal, unit: UnitRef): boolean {
	return unit.isCentral || unit.tenantId === p.tenantId;
}

// ---------------------------------------------------------------------------
// Einheiten und delegierte Schreibrechte (Kap. 5.2)
// ---------------------------------------------------------------------------

/** Pflegt Seite, Team und Schreibrechte der Einheit. */
export function canManageUnit(
	p: Principal,
	unit: UnitRef,
	unitHasOwnMaintenance: boolean
): boolean {
	if (!canSeeUnit(p, unit)) return false;
	if (hasUnitRole(p, 'abteilungsverwaltung', unit.id) || hasUnitRole(p, 'hub_team', unit.id)) {
		return true;
	}
	// Einheiten ohne eigene Pflege pflegt die Redaktion (Kap. 3.2, 10)
	return !unitHasOwnMaintenance && isEditorial(p, unit.tenantId);
}

type WriteRight = 'mayWriteNews' | 'mayWriteFaqs' | 'mayWriteEvents' | 'mayWriteBehindScenes';

function hasDelegated(p: Principal, unitId: string, right: WriteRight): boolean {
	return p.memberships.some((m) => m.unitId === unitId && m[right]);
}

/** Darf im Namen der Einheit Neuigkeiten schreiben. */
export function canWriteNews(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteNews') ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/** Einheiten, für die die Person Neuigkeiten schreiben darf (IDs). */
export function newsUnitIds(p: Principal): Set<string> {
	const ids = new Set<string>();
	for (const m of p.memberships) if (m.mayWriteNews) ids.add(m.unitId);
	for (const r of p.roles) {
		if ((r.role === 'abteilungsverwaltung' || r.role === 'hub_team') && r.scopeUnitId) {
			ids.add(r.scopeUnitId);
		}
	}
	return ids;
}

// ---------------------------------------------------------------------------
// Rollen vergeben (Verwaltung → Benutzer und Rollen)
// ---------------------------------------------------------------------------

export interface GrantTarget {
	role: Role;
	scope: 'all' | 'tenant' | 'unit';
	/** Bei „tenant“ der Mandant, bei „unit“ der Mandant der Einheit. */
	tenantId: string | null;
}

/**
 * System-Admins vergeben alles. Mandanten-Admins nur Rollen im eigenen
 * Mandanten (Geltungsbereich Mandant oder Einheit), nie Admin-Rollen und nie
 * „alle Mandanten“. Gilt ebenso fürs Entziehen.
 */
export function canGrantRole(p: Principal, t: GrantTarget): boolean {
	if (isSystemAdmin(p)) return true;
	if (t.role === 'system_admin' || t.role === 'mandanten_admin') return false;
	if (t.scope === 'all' || !t.tenantId) return false;
	return canAdministerTenant(p, t.tenantId);
}
