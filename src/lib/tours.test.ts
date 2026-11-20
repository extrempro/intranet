import { describe, expect, it } from 'vitest';
import { ALL_TOUR_KEYS, FUEHRUNG, isTourKey, ROLLEN, SEITEN } from './tours.ts';

describe('Führung und Einführungen', () => {
	it('hat eindeutige Schlüssel', () => {
		expect(new Set(ALL_TOUR_KEYS).size).toBe(ALL_TOUR_KEYS.length);
	});
	it('Führung hat 8 Schritte, Seiten und Rollen je 3', () => {
		expect(FUEHRUNG.steps).toHaveLength(8);
		for (const t of [...Object.values(SEITEN), ...Object.values(ROLLEN)])
			expect(t.steps).toHaveLength(3);
	});
	it('erkennt nur bekannte Schlüssel', () => {
		expect(isTourKey('fuehrung')).toBe(true);
		expect(isTourKey('seite:kalender')).toBe(true);
		expect(isTourKey('rolle:redaktion')).toBe(true);
		expect(isTourKey('seite:gibtsnicht')).toBe(false);
		expect(isTourKey('')).toBe(false);
	});
});
