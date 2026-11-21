import { describe, expect, it } from 'vitest';
import { fehlerText, fehlerTitel } from './fehler.ts';

describe('Fehlerseiten', () => {
	it('Titel in einfacher Sprache', () => {
		expect(fehlerTitel(404)).toBe('Seite nicht gefunden');
		expect(fehlerTitel(403)).toBe('Dafür fehlt dir das Recht');
		expect(fehlerTitel(500)).toBe('Da ist etwas schiefgegangen');
		expect(fehlerTitel(418)).toBe('Das hat nicht geklappt');
	});
	it('zeigt eigene Meldungen, aber keine englischen Standardtexte oder Wiederholungen', () => {
		expect(fehlerText('Diese Abteilung gibt es nicht.', 'Seite nicht gefunden')).toBe(
			'Diese Abteilung gibt es nicht.'
		);
		expect(fehlerText('Not Found', 'Seite nicht gefunden')).toBeNull();
		expect(fehlerText('Internal Error', 'x')).toBeNull();
		expect(fehlerText('Dafür fehlt dir das Recht.', 'Dafür fehlt dir das Recht')).toBeNull();
		expect(fehlerText(undefined, 'x')).toBeNull();
	});
});
