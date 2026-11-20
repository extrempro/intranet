import { describe, expect, it } from 'vitest';
import {
	canAdministerTenant,
	canManageUnit,
	canSeeAdministration,
	canSeeUnit,
	canWriteNews,
	isEditorial,
	newsUnitIds,
	type Principal
} from './access';

const HSO = 'm-hso';
const B = 'm-b';
const it_ = { id: 'u-it', tenantId: HSO, isCentral: true };
const kbbB = { id: 'u-kbb-b', tenantId: B, isCentral: false };
const kbbHso = { id: 'u-kbb-hso', tenantId: HSO, isCentral: false };

function person(overrides: Partial<Principal> = {}): Principal {
	return { personId: 'p', tenantId: B, roles: [], memberships: [], ...overrides };
}

describe('Mandantentrennung', () => {
	it('zeigt eigene und zentrale Einheiten, keine fremden', () => {
		const p = person();
		expect(canSeeUnit(p, kbbB)).toBe(true);
		expect(canSeeUnit(p, it_)).toBe(true);
		expect(canSeeUnit(p, kbbHso)).toBe(false);
	});

	it('schützt fremde Einheiten auch bei passender Mitgliedschaft (fehlerhafte Daten)', () => {
		const p = person({
			memberships: [
				{
					unitId: kbbHso.id,
					isPrimary: false,
					mayWriteNews: true,
					mayWriteFaqs: false,
					mayWriteEvents: false,
					mayWriteBehindScenes: false
				}
			]
		});
		expect(canWriteNews(p, kbbHso)).toBe(false);
	});
});

describe('Verwaltung', () => {
	it('Mandanten-Admin nur für den eigenen Mandanten', () => {
		const p = person({
			roles: [{ role: 'mandanten_admin', scope: 'tenant', scopeTenantId: B, scopeUnitId: null }]
		});
		expect(canAdministerTenant(p, B)).toBe(true);
		expect(canAdministerTenant(p, HSO)).toBe(false);
		expect(canSeeAdministration(p)).toBe(true);
	});

	it('System-Admin für alle', () => {
		const p = person({
			roles: [{ role: 'system_admin', scope: 'all', scopeTenantId: null, scopeUnitId: null }]
		});
		expect(canAdministerTenant(p, HSO)).toBe(true);
	});

	it('ohne Rolle keine Verwaltung', () => {
		expect(canSeeAdministration(person())).toBe(false);
	});
});

describe('Einheiten pflegen', () => {
	const redaktionB = person({
		roles: [{ role: 'redaktion', scope: 'tenant', scopeTenantId: B, scopeUnitId: null }]
	});

	it('Abteilungsverwaltung pflegt ihre Einheit', () => {
		const p = person({
			roles: [
				{ role: 'abteilungsverwaltung', scope: 'unit', scopeTenantId: null, scopeUnitId: kbbB.id }
			]
		});
		expect(canManageUnit(p, kbbB, true)).toBe(true);
		expect(canWriteNews(p, kbbB)).toBe(true);
	});

	it('Redaktion pflegt nur Einheiten ohne eigene Pflege im eigenen Geltungsbereich', () => {
		expect(canManageUnit(redaktionB, kbbB, false)).toBe(true);
		expect(canManageUnit(redaktionB, kbbB, true)).toBe(false);
		expect(isEditorial(redaktionB, HSO)).toBe(false);
	});
});

describe('Delegierte Schreibrechte', () => {
	it('Neuigkeiten nur mit Recht', () => {
		const p = person({
			memberships: [
				{
					unitId: kbbB.id,
					isPrimary: true,
					mayWriteNews: true,
					mayWriteFaqs: false,
					mayWriteEvents: false,
					mayWriteBehindScenes: false
				},
				{
					unitId: it_.id,
					isPrimary: false,
					mayWriteNews: false,
					mayWriteFaqs: true,
					mayWriteEvents: false,
					mayWriteBehindScenes: false
				}
			]
		});
		expect(canWriteNews(p, kbbB)).toBe(true);
		expect(canWriteNews(p, it_)).toBe(false);
		expect([...newsUnitIds(p)]).toEqual([kbbB.id]);
	});
});
