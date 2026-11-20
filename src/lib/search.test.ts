import { describe, expect, it } from 'vitest';
import { isSearchKind, splitMarks, toTsQuery } from './search.ts';

describe('Suche', () => {
	it('baut eine Präfix-Abfrage nur aus Wörtern', () => {
		expect(toTsQuery('Urlaubs  antr')).toBe('Urlaubs:* & antr:*');
		expect(toTsQuery("x' | !y & (z) <-> :* \\")).toBe('x:* & y:* & z:*');
		expect(toTsQuery('Größe 2026')).toBe('Größe:* & 2026:*');
		expect(toTsQuery('  !!! ')).toBeNull();
		expect(toTsQuery('a b c d e f g h')?.split('&').length).toBe(6);
	});

	it('zerlegt Hervorhebungen', () => {
		expect(splitMarks('vor \u0001Treffer\u0002 nach')).toEqual([
			{ text: 'vor ', mark: false },
			{ text: 'Treffer', mark: true },
			{ text: ' nach', mark: false }
		]);
		expect(splitMarks('<b>kein html</b>')).toEqual([{ text: '<b>kein html</b>', mark: false }]);
	});

	it('kennt die Trefferarten', () => {
		expect(isSearchKind('personen')).toBe(true);
		expect(isSearchKind('dateien')).toBe(false);
		expect(isSearchKind(null)).toBe(false);
	});
});
