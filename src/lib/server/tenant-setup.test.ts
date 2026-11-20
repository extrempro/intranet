import { describe, expect, it } from 'vitest';
import { checkAccent, contrastRatio } from '../color';
import { normalizeDomain, parseDomainList } from '../domain';
import { readInitialTenant } from './bootstrap-config';

describe('Domains', () => {
	it('vereinheitlicht', () => {
		expect(normalizeDomain(' @Staatsoper-Hamburg.DE. ')).toBe('staatsoper-hamburg.de');
		expect(normalizeDomain('staatsoper.onmicrosoft.com')).toBe('staatsoper.onmicrosoft.com');
	});
	it('lehnt Ungültiges ab', () => {
		for (const d of ['', 'localhost', 'a b.de', 'x@y.de', '-a.de', 'a..de'])
			expect(normalizeDomain(d)).toBeNull();
	});
	it('liest Listen und trennt Ungültiges', () => {
		expect(parseDomainList('a.de, B.de;a.de\nkaputt')).toEqual({
			domains: ['a.de', 'b.de'],
			invalid: ['kaputt']
		});
	});
});

describe('Kontrast', () => {
	it('rechnet wie WCAG', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
	});
	it('nimmt die Farben aus dem Entwurf an', () => {
		expect(checkAccent('#0F6E56', '#5DCAA5').ok).toBe(true);
		expect(checkAccent('#6A3E9E', '#BBA4E3').ok).toBe(true);
	});
	it('lehnt zu helle Akzente ab', () => {
		expect(checkAccent('#7FD8BE', '#5DCAA5').ok).toBe(false);
		expect(checkAccent('#0F6E56', '#0F6E56').ok).toBe(false);
	});
});

describe('readInitialTenant', () => {
	it('ist ohne Angaben aus', () => {
		expect(readInitialTenant({})).toBeNull();
	});
	it('liest vollständige Angaben', () => {
		expect(
			readInitialTenant({
				INITIAL_TENANT_NAME: 'Staatsoper Hamburg',
				INITIAL_TENANT_SHORT: 'HSO',
				INITIAL_TENANT_DOMAINS: 'staatsoper-hamburg.de, staatsoper.onmicrosoft.com'
			})
		).toEqual({
			name: 'Staatsoper Hamburg',
			shortName: 'HSO',
			domains: ['staatsoper-hamburg.de', 'staatsoper.onmicrosoft.com'],
			accent: null,
			accentDark: null
		});
	});
	it('meldet Unvollständiges und Ungültiges laut', () => {
		expect(() => readInitialTenant({ INITIAL_TENANT_NAME: 'X' })).toThrow(/zusammen/);
		expect(() =>
			readInitialTenant({
				INITIAL_TENANT_NAME: 'X',
				INITIAL_TENANT_SHORT: 'X',
				INITIAL_TENANT_DOMAINS: 'kaputt'
			})
		).toThrow(/ungültige/);
	});
});
