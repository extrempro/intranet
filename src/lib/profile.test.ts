import { describe, expect, it } from 'vitest';
import { mobileVisible, validateContact } from './profile.ts';

const base = { position: '', phone: '', mobile: '', mobileVisibility: 'team', room: '' };

describe('Kontaktdaten', () => {
	it('übernimmt gültige Angaben und leert leere Felder', () => {
		const r = validateContact({
			...base,
			position: '  Leitung   IT ',
			phone: '+49 40 3568-123',
			mobile: '0170 1234567'
		});
		expect(r.value).toEqual({
			position: 'Leitung IT',
			phone: '+49 40 3568-123',
			mobile: '0170 1234567',
			mobileVisibility: 'team',
			room: null
		});
	});

	it('lehnt ungültige Nummern und Sichtbarkeiten ab', () => {
		expect(validateContact({ ...base, phone: 'ruf mich an' }).errors.phone).toBeTruthy();
		expect(validateContact({ ...base, mobile: '<script>' }).errors.mobile).toBeTruthy();
		expect(
			validateContact({ ...base, mobileVisibility: 'welt' }).errors.mobileVisibility
		).toBeTruthy();
		expect(validateContact({ ...base, room: 'x'.repeat(41) }).errors.room).toBeTruthy();
	});

	it('zeigt die Mobilnummer nur nach Sichtbarkeit', () => {
		expect(mobileVisible('nobody', true, false)).toBe(true);
		expect(mobileVisible('nobody', false, true)).toBe(false);
		expect(mobileVisible('team', false, true)).toBe(true);
		expect(mobileVisible('team', false, false)).toBe(false);
		expect(mobileVisible('all', false, false)).toBe(true);
	});
});
