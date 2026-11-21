import { describe, expect, it } from 'vitest';
import {
	isFeedbackStatus,
	safeReturnPath,
	validateFeedback,
	technikAusEingabe
} from './feedback.ts';

describe('Rückmeldungen', () => {
	it('springt nur auf eigene Seiten zurück', () => {
		expect(safeReturnPath('/kalender?monat=2026-11')).toBe('/kalender?monat=2026-11');
		expect(safeReturnPath('//evil.example')).toBe('/');
		expect(safeReturnPath('https://evil.example')).toBe('/');
		expect(safeReturnPath('/\\evil')).toBe('/');
		expect(safeReturnPath('/rueckmeldung/neu')).toBe('/');
		expect(safeReturnPath(null)).toBe('/');
	});

	it('prüft Art und Text', () => {
		expect(validateFeedback({ kind: 'fehler', text: 'Knopf geht nicht' })).toEqual({});
		expect(validateFeedback({ kind: 'lob', text: 'Knopf geht nicht' }).kind).toBeTruthy();
		expect(validateFeedback({ kind: 'idee', text: ' kurz ' }).text).toBeTruthy();
		expect(validateFeedback({ kind: 'idee', text: 'x'.repeat(2001) }).text).toBeTruthy();
		expect(isFeedbackStatus('erledigt')).toBe(true);
		expect(isFeedbackStatus('weg')).toBe(false);
	});
});

describe('technikAusEingabe', () => {
	it('übernimmt gültige Angaben', () => {
		const t = technikAusEingabe(
			JSON.stringify({
				version: '0.12.1',
				fenster: '1280 × 800',
				teams: true,
				fehler: ['a', 'b', 'c', 'd', 'e', 'f']
			}),
			'Mozilla/5.0'
		);
		expect(t).toEqual({
			version: '0.12.1',
			fenster: '1280 × 800',
			browser: 'Mozilla/5.0',
			teams: true,
			fehler: ['b', 'c', 'd', 'e', 'f']
		});
	});
	it('verwirft Ungültiges, Steuerzeichen und kaputtes JSON', () => {
		expect(
			technikAusEingabe(
				JSON.stringify({
					version: '1.0<script>',
					fenster: 'groß',
					teams: 'ja',
					fehler: ['x\nINJ', 5]
				}),
				null
			)
		).toEqual({ version: null, fenster: null, browser: null, teams: false, fehler: ['x INJ'] });
		expect(technikAusEingabe('{kaputt', 'UA')).toEqual({
			version: null,
			fenster: null,
			browser: 'UA',
			teams: false,
			fehler: []
		});
	});
});
