/**
 * Rollen einer Person laden und prüfen. Wird in Schritt 4 zur zentralen
 * Rechteprüfung ausgebaut.
 */
import { eq } from 'drizzle-orm';
import type { Role } from '../../roles.ts';
import { db } from '../db/index.ts';
import { roleAssignments } from '../db/schema.ts';

export interface RoleGrant {
	role: Role;
	scope: 'all' | 'tenant' | 'unit';
	scopeTenantId: string | null;
	scopeUnitId: string | null;
}

export async function loadRoles(personId: string): Promise<RoleGrant[]> {
	return db
		.select({
			role: roleAssignments.role,
			scope: roleAssignments.scope,
			scopeTenantId: roleAssignments.scopeTenantId,
			scopeUnitId: roleAssignments.scopeUnitId
		})
		.from(roleAssignments)
		.where(eq(roleAssignments.personId, personId));
}

export function isSystemAdmin(roles: readonly RoleGrant[]): boolean {
	return roles.some((r) => r.role === 'system_admin');
}

/** Mandanten-Admin dieses Mandanten oder System-Admin. */
export function canAdministerTenant(roles: readonly RoleGrant[], tenantId: string): boolean {
	return (
		isSystemAdmin(roles) ||
		roles.some((r) => r.role === 'mandanten_admin' && r.scopeTenantId === tenantId)
	);
}

export function isAnyAdmin(roles: readonly RoleGrant[]): boolean {
	return roles.some((r) => r.role === 'system_admin' || r.role === 'mandanten_admin');
}
