/**
 * Zentrale Rechteprüfung (Kap. 2, 5, 16). Alles hier ist rein und getestet;
 * geladen wird der Principal einmal je Anfrage im Hook (locals.principal).
 *
 * Die Mandantentrennung gilt doppelt: hier im Code und zusätzlich per
 * Row-Level Security in PostgreSQL (siehe db/index.ts, scoped()).
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Role } from '../../roles.ts';
import { db } from '../db/index.ts';
import { locationOperators, roleAssignments, unitMembers, units } from '../db/schema.ts';

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
	/** Dokumente der Einheit pflegen (Hubs und Abteilungen) */
	mayWriteDocuments?: boolean;
	/** Mediathek der Einheit pflegen (Kap. 8.15) */
	mayWriteMedia?: boolean;
	/** Umfragen an Beiträgen der Einheit (Kap. 8.16) */
	mayWriteSurveys?: boolean;
}

export interface Principal {
	personId: string;
	tenantId: string;
	roles: RoleGrant[];
	memberships: Membership[];
	/** Betreiber-Konto: nur dieser Standort, sonst nichts (Kap. 4.3). */
	operatorLocationId?: string | null;
	/**
	 * Redaktion: Einheiten ohne eigene Pflege in ihrem Bereich. Für sie schreibt
	 * sie Beiträge, FAQs und Termine (Kap. 10). Beim Laden der Person berechnet.
	 */
	ohnePflege?: string[];
}

/** Die für Rechte nötigen Angaben einer Einheit. */
export interface UnitRef {
	id: string;
	tenantId: string;
	isCentral: boolean;
}

export async function loadPrincipal(person: { id: string; tenantId: string }): Promise<Principal> {
	const [roles, memberships, operator] = await Promise.all([
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
				mayWriteBehindScenes: unitMembers.mayWriteBehindScenes,
				mayWriteDocuments: unitMembers.mayWriteDocuments,
				mayWriteMedia: unitMembers.mayWriteMedia,
				mayWriteSurveys: unitMembers.mayWriteSurveys
			})
			.from(unitMembers)
			.where(eq(unitMembers.personId, person.id)),
		db
			.select({ locationId: locationOperators.locationId })
			.from(locationOperators)
			.where(eq(locationOperators.personId, person.id))
	]);
	return {
		personId: person.id,
		tenantId: person.tenantId,
		roles,
		memberships,
		operatorLocationId: operator[0]?.locationId ?? null,
		ohnePflege: await einheitenOhnePflege(roles)
	};
}

/** Einheiten ohne Abteilungsverwaltung bzw. Hub-Team im Bereich der Redaktion. */
async function einheitenOhnePflege(roles: RoleGrant[]): Promise<string[]> {
	const red = roles.filter((r) => r.role === 'redaktion');
	if (!red.length) return [];
	const alle = red.some((r) => r.scope === 'all');
	const mandanten = red.map((r) => r.scopeTenantId).filter((t): t is string => Boolean(t));
	if (!alle && !mandanten.length) return [];
	const rows = await db
		.select({ id: units.id })
		.from(units)
		.where(
			and(
				isNull(units.archivedAt),
				alle ? undefined : inArray(units.tenantId, mandanten),
				sql`not exists (select 1 from role_assignments r where r.scope_unit_id = ${units.id} and r.role in ('abteilungsverwaltung', 'hub_team'))`
			)
		);
	return rows.map((r) => r.id);
}

/** Redaktion schreibt für diese Einheit, weil sie keine eigene Pflege hat. */
function redaktionOhnePflege(p: Principal, unitId: string): boolean {
	return Boolean(p.ohnePflege?.includes(unitId));
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

/**
 * Mandanten, für die die Person Redaktion ist: 'alle' bei Redaktion für alle,
 * sonst die einzelnen Mandanten (leer = keine Redaktion).
 */
export function editorialTenants(p: Principal): 'alle' | string[] {
	const r = p.roles.filter((x) => x.role === 'redaktion');
	if (r.some((x) => x.scope === 'all')) return 'alle';
	return [...new Set(r.map((x) => x.scopeTenantId).filter((t): t is string => Boolean(t)))];
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

type WriteRight =
	| 'mayWriteNews'
	| 'mayWriteFaqs'
	| 'mayWriteEvents'
	| 'mayWriteBehindScenes'
	| 'mayWriteMedia'
	| 'mayWriteSurveys';

function hasDelegated(p: Principal, unitId: string, right: WriteRight): boolean {
	return p.memberships.some((m) => m.unitId === unitId && m[right]);
}

/** Darf im Namen der Einheit Neuigkeiten schreiben. */
export function canWriteNews(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteNews') ||
		redaktionOhnePflege(p, unit.id) ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/** Darf FAQs der Einheit anlegen, ändern und löschen. */
export function canWriteFaqs(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteFaqs') ||
		redaktionOhnePflege(p, unit.id) ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/** Darf Videos der Einheit hochladen, bearbeiten, veröffentlichen und löschen (Kap. 8.15). */
export function canWriteMedia(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteMedia') ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/**
 * Darf an Beiträgen der Einheit Umfragen anlegen, ändern, beenden und alle
 * Ergebnisse sehen (Kap. 8.16). Ob Umfragen eingeschaltet sind, prüft der Aufrufer.
 */
export function canWriteSurveys(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteSurveys') ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/** Einheiten, für die die Person Umfragen anlegen darf (IDs, ohne Sichtprüfung). */
export function surveyUnitIds(p: Principal): Set<string> {
	return writeUnitIds(p, 'mayWriteSurveys');
}

/** Einheiten, für die die Person die Mediathek pflegen darf (IDs, ohne Sichtprüfung). */
export function mediaUnitIds(p: Principal): Set<string> {
	return writeUnitIds(p, 'mayWriteMedia');
}

/** Einheiten, für die die Person Neuigkeiten schreiben darf (IDs). */
export function newsUnitIds(p: Principal): Set<string> {
	return writeUnitIds(p, 'mayWriteNews');
}

/**
 * Darf im Namen der Einheit Termine anlegen. Ob die Einheit überhaupt Termine
 * haben darf (Regel/Ausnahme), prüft der Aufrufer zusätzlich (roles.ts).
 */
export function canWriteEvents(p: Principal, unit: UnitRef): boolean {
	if (!canSeeUnit(p, unit)) return false;
	return (
		hasDelegated(p, unit.id, 'mayWriteEvents') ||
		redaktionOhnePflege(p, unit.id) ||
		hasUnitRole(p, 'abteilungsverwaltung', unit.id) ||
		hasUnitRole(p, 'hub_team', unit.id)
	);
}

/** Einheiten, für die die Person Termine anlegen darf (IDs, ohne Regelprüfung). */
export function eventUnitIds(p: Principal): Set<string> {
	return writeUnitIds(p, 'mayWriteEvents');
}

/** Einheiten, für die die Person FAQs pflegen darf (IDs). */
export function faqUnitIds(p: Principal): Set<string> {
	return writeUnitIds(p, 'mayWriteFaqs');
}

function writeUnitIds(p: Principal, right: WriteRight): Set<string> {
	const ids = new Set<string>();
	for (const m of p.memberships) if (m[right]) ids.add(m.unitId);
	// Redaktion: Beiträge, FAQs und Termine für Einheiten ohne eigene Pflege
	if (right === 'mayWriteNews' || right === 'mayWriteFaqs' || right === 'mayWriteEvents')
		for (const id of p.ohnePflege ?? []) ids.add(id);
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
