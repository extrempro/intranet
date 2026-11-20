import { describe, expect, it } from 'vitest';
import { mayPostUrgent } from './roles';
import { slugify } from './slug';

describe('slugify', () => {
	it('ersetzt Umlaute und Sonderzeichen', () => {
		expect(slugify('Personal (HR)')).toBe('personal-hr');
		expect(slugify('Bühnentechnik & Maske')).toBe('buehnentechnik-maske');
		expect(slugify('  Kaufmännische Geschäftsführung ')).toBe('kaufmaennische-geschaeftsfuehrung');
		expect(slugify('Straße')).toBe('strasse');
	});

	it('liefert für reine Sonderzeichen nichts', () => {
		expect(slugify('!!!')).toBe('');
	});
});

describe('mayPostUrgent', () => {
	it('folgt dem Typ, solange nichts gesetzt ist', () => {
		expect(mayPostUrgent({ type: 'geschaeftsfuehrung', mayPostUrgent: null, isKbb: false })).toBe(
			true
		);
		expect(mayPostUrgent({ type: 'abteilung', mayPostUrgent: null, isKbb: true })).toBe(true);
		expect(mayPostUrgent({ type: 'abteilung', mayPostUrgent: null, isKbb: false })).toBe(false);
	});

	it('nimmt die Einstellung der Verwaltung', () => {
		expect(mayPostUrgent({ type: 'abteilung', mayPostUrgent: true, isKbb: false })).toBe(true);
		expect(mayPostUrgent({ type: 'geschaeftsfuehrung', mayPostUrgent: false, isKbb: false })).toBe(
			false
		);
	});
});
