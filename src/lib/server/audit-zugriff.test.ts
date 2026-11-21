import { describe, expect, it } from 'vitest';
import { pfadMuster, sollProtokollieren } from './audit-zugriff.ts';

describe('Verweigerte Zugriffe protokollieren', () => {
	it('fasst IDs im Pfad zusammen', () => {
		expect(pfadMuster('/verwaltung/benutzer/00000000-0000-0000-0000-0000000000b2')).toBe(
			'/verwaltung/benutzer/:id'
		);
	});
	it('höchstens einmal in 10 Minuten je Person, Pfad und Aktion', () => {
		const t = 1_000_000;
		expect(sollProtokollieren('p|/x|', t)).toBe(true);
		expect(sollProtokollieren('p|/x|', t + 60_000)).toBe(false);
		expect(sollProtokollieren('p|/x|sperren', t + 60_000)).toBe(true);
		expect(sollProtokollieren('p|/x|', t + 11 * 60_000)).toBe(true);
	});
});
