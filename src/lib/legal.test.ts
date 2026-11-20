import { describe, expect, it } from 'vitest';
import { validateAgreement, validateLegalLink } from './legal.ts';

describe('Rechtliches', () => {
	const a = {
		kind: 'betrieb',
		title: 'Mobiles Arbeiten',
		description: '',
		versionDate: '2026-10-01',
		validFrom: '2026-11-01'
	};

	it('prüft Vereinbarungen', () => {
		expect(validateAgreement(a)).toEqual({});
		expect(validateAgreement({ ...a, kind: 'x' }).kind).toBeTruthy();
		expect(validateAgreement({ ...a, title: 'ab' }).title).toBeTruthy();
		expect(validateAgreement({ ...a, versionDate: '2026-02-30' }).versionDate).toBeTruthy();
		expect(validateAgreement({ ...a, validFrom: '' }).validFrom).toBeTruthy();
	});

	it('verlangt Link oder Datei und erlaubt nur sichere Adressen', () => {
		const l = { kind: 'gesetz', title: 'Arbeitszeitgesetz', description: '', url: '' };
		expect(validateLegalLink(l, false).url).toBeTruthy();
		expect(validateLegalLink(l, true)).toEqual({});
		expect(
			validateLegalLink({ ...l, url: 'https://www.gesetze-im-internet.de/arbzg/' }, false)
		).toEqual({});
		expect(validateLegalLink({ ...l, url: 'javascript:alert(1)' }, false).url).toBeTruthy();
		expect(validateLegalLink({ ...l, kind: 'x' }, true).kind).toBeTruthy();
	});
});
