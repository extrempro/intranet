import { describe, expect, it } from 'vitest';
import { kapitelAusText, kapitelFehler, zeitLesen, zeitText } from './mediathek.ts';

describe('Mediathek: Zeiten und Kapitel', () => {
	it('Zeiten lesen und schreiben', () => {
		expect(zeitText(0)).toBe('0:00');
		expect(zeitText(65)).toBe('1:05');
		expect(zeitText(3725)).toBe('1:02:05');
		expect(zeitLesen('1:05')).toBe(65);
		expect(zeitLesen('1:02:05')).toBe(3725);
		expect(zeitLesen('1:60')).toBeNaN();
		expect(zeitLesen('abc')).toBeNaN();
	});

	it('Kapitel aus Text', () => {
		expect(kapitelAusText('0:00 Einleitung\nohne Zeit\n1:30 - Anmelden\n')).toEqual([
			{ s: 0, t: 'Einleitung' },
			{ s: 90, t: 'Anmelden' }
		]);
	});

	it('Kapitel prüfen', () => {
		expect(
			kapitelFehler(
				[
					{ s: 0, t: 'A' },
					{ s: 0, t: 'B' },
					{ s: 50, t: '' },
					{ s: 200, t: 'C' }
				],
				100
			)
		).toEqual([
			'',
			'Muss nach dem vorigen Kapitel beginnen',
			'Titel fehlt',
			'Liegt nach dem Ende des Videos'
		]);
		expect(kapitelFehler([{ s: 5, t: 'A' }], 100)[0]).toMatch(/0:00/);
	});
});
