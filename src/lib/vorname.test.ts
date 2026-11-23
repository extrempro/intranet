import { describe, expect, it } from 'vitest';
import { vorname } from './vorname.ts';

describe('vorname', () => {
	it('nimmt den Vornamen aus Entra', () => {
		expect(vorname('Muster, Erika', 'Erika')).toBe('Erika');
		expect(vorname('Erika Muster', ' Anna Lena ')).toBe('Anna');
	});
	it('liest „Nachname, Vorname“', () => {
		expect(vorname('Muster, Erika')).toBe('Erika');
		expect(vorname('Muster-Beispiel, Dr. Erika Maria')).toBe('Erika');
	});
	it('liest „Vorname Nachname“ und überspringt Titel', () => {
		expect(vorname('Erika Muster')).toBe('Erika');
		expect(vorname('Dr. Erika Muster')).toBe('Erika');
		expect(vorname('Prof. Dr. Max Beispiel')).toBe('Max');
	});
	it('fällt auf den ganzen Namen zurück', () => {
		expect(vorname('erika@example.com')).toBe('erika@example.com');
		expect(vorname('Muster,')).toBe('Muster,');
	});
});
