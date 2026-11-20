import { describe, expect, it } from 'vitest';
import { canGrantRole, type Principal } from './access';

const sys: Principal = {
	personId: 's',
	tenantId: 'A',
	roles: [{ role: 'system_admin', scope: 'all', scopeTenantId: null, scopeUnitId: null }],
	memberships: []
};
const adminB: Principal = {
	personId: 'b',
	tenantId: 'B',
	roles: [{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: 'B', scopeUnitId: null }],
	memberships: []
};
const nobody: Principal = { personId: 'n', tenantId: 'B', roles: [], memberships: [] };

describe('canGrantRole', () => {
	it('System-Admins dürfen alles', () => {
		expect(canGrantRole(sys, { role: 'system_admin', scope: 'all', tenantId: null })).toBe(true);
		expect(canGrantRole(sys, { role: 'organigramm_pflegen', scope: 'all', tenantId: null })).toBe(
			true
		);
	});

	it('Mandanten-Admins nur im eigenen Mandanten', () => {
		expect(canGrantRole(adminB, { role: 'redaktion', scope: 'tenant', tenantId: 'B' })).toBe(true);
		expect(canGrantRole(adminB, { role: 'fachpflege', scope: 'unit', tenantId: 'B' })).toBe(true);
		expect(canGrantRole(adminB, { role: 'redaktion', scope: 'tenant', tenantId: 'A' })).toBe(false);
		expect(canGrantRole(adminB, { role: 'fachpflege', scope: 'unit', tenantId: 'A' })).toBe(false);
	});

	it('Mandanten-Admins nie Admin-Rollen und nie „alle Mandanten“', () => {
		expect(canGrantRole(adminB, { role: 'mandanten_admin', scope: 'tenant', tenantId: 'B' })).toBe(
			false
		);
		expect(canGrantRole(adminB, { role: 'system_admin', scope: 'all', tenantId: null })).toBe(
			false
		);
		expect(
			canGrantRole(adminB, { role: 'organigramm_pflegen', scope: 'all', tenantId: null })
		).toBe(false);
		expect(canGrantRole(adminB, { role: 'redaktion', scope: 'all', tenantId: null })).toBe(false);
	});

	it('ohne Admin-Rolle nichts', () => {
		expect(canGrantRole(nobody, { role: 'redaktion', scope: 'tenant', tenantId: 'B' })).toBe(false);
	});
});
