import { describe, expect, it } from 'vitest';
import { isRole, isValidRoleScope, unitTypeLabel } from './roles';

describe('isValidRoleScope', () => {
	it('erlaubt Redaktion für einen Mandanten oder alle', () => {
		expect(isValidRoleScope('redaktion', 'tenant')).toBe(true);
		expect(isValidRoleScope('redaktion', 'all')).toBe(true);
		expect(isValidRoleScope('redaktion', 'unit', 'abteilung')).toBe(false);
	});

	it('erlaubt System-Admin nur für alle', () => {
		expect(isValidRoleScope('system_admin', 'all')).toBe(true);
		expect(isValidRoleScope('system_admin', 'tenant')).toBe(false);
	});

	it('prüft bei Einheiten den Typ', () => {
		expect(isValidRoleScope('hub_team', 'unit', 'hub')).toBe(true);
		expect(isValidRoleScope('hub_team', 'unit', 'abteilung')).toBe(false);
		expect(isValidRoleScope('abteilungsverwaltung', 'unit', 'stabsstelle')).toBe(true);
		expect(isValidRoleScope('abteilungsverwaltung', 'unit', 'hub')).toBe(false);
		expect(isValidRoleScope('abteilungsverwaltung', 'unit')).toBe(false);
	});
});

describe('isRole', () => {
	it('erkennt bekannte Rollen', () => {
		expect(isRole('redaktion')).toBe(true);
		expect(isRole('autor')).toBe(false);
	});
});

describe('unitTypeLabel', () => {
	it('nimmt den Titel bei Geschäftsführung und Stabsstelle', () => {
		expect(unitTypeLabel({ type: 'geschaeftsfuehrung', title: 'Intendanz' })).toBe('Intendanz');
		expect(unitTypeLabel({ type: 'stabsstelle', title: 'Datenschutzbeauftragte' })).toBe(
			'Datenschutzbeauftragte'
		);
	});

	it('nimmt sonst die Typbezeichnung', () => {
		expect(unitTypeLabel({ type: 'geschaeftsfuehrung', title: '  ' })).toBe('Geschäftsführung');
		expect(unitTypeLabel({ type: 'abteilung', title: 'Ignoriert' })).toBe('Abteilung');
		expect(unitTypeLabel({ type: 'hub' })).toBe('Hub');
	});
});
