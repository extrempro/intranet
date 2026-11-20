import { expect, it } from 'vitest';
import { actionUrl } from './action-url.ts';

it('behält Ansicht und Filter für Formular-Aktionen', () => {
	expect(actionUrl('', 'favorit')).toBe('?/favorit');
	expect(actionUrl('?ansicht=meine&neu=1', 'erledigt')).toBe('?ansicht=meine&/erledigt');
	expect(actionUrl('?einheit=x&/verschieben', 'verschieben')).toBe('?einheit=x&/verschieben');
});
