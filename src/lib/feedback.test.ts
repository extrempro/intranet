import { describe, expect, it } from 'vitest';
import { isFeedbackStatus, safeReturnPath, validateFeedback } from './feedback.ts';

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
