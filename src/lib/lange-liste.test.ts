import { describe, expect, it } from 'vitest';
import { anzahlAus, mitZahl, monatVon, nachMonat } from './lange-liste.ts';

const url = (q: string) => new URL(`https://example.com/liste${q}`);

describe('lange Listen (Kap. 6.7)', () => {
	it('liest die Anzahl als Vielfaches des Schritts mit Grenzen', () => {
		expect(anzahlAus(url(''), 20, 500)).toBe(20);
		expect(anzahlAus(url('?anzahl=abc'), 20, 500)).toBe(20);
		expect(anzahlAus(url('?anzahl=-5'), 20, 500)).toBe(20);
		expect(anzahlAus(url('?anzahl=40'), 20, 500)).toBe(40);
		expect(anzahlAus(url('?anzahl=41'), 20, 500)).toBe(60);
		expect(anzahlAus(url('?anzahl=99999'), 20, 500)).toBe(500);
	});

	it('ordnet Monate in Berliner Zeit zu', () => {
		// 31.10. 23:30 UTC ist in Berlin schon der 1. November
		expect(monatVon(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
		expect(monatVon(new Date('2026-10-31T21:00:00Z'))).toBe('2026-10');
	});

	it('gruppiert nach Monat mit Gesamtzahl je Monat', () => {
		const e = ['2026-11-20', '2026-11-02', '2026-10-15'].map((d) => ({
			d: new Date(`${d}T12:00:00Z`)
		}));
		const g = nachMonat(e, (x) => x.d, [{ monat: '2026-11', n: 7 }]);
		expect(g.map((x) => [x.titel, x.anzahl, x.eintraege.length])).toEqual([
			['November 2026', 7, 2],
			['Oktober 2026', 1, 1]
		]);
	});

	it('schreibt Einzahl und Mehrzahl', () => {
		expect(mitZahl(1, 'Beitrag', 'Beiträge')).toBe('1 Beitrag');
		expect(mitZahl(3, 'Beitrag', 'Beiträge')).toBe('3 Beiträge');
	});
});
