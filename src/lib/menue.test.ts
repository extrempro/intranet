import { describe, expect, it } from 'vitest';
import { menueLesen, menueWert } from './menue.ts';

const ERLAUBT = ['aktuelles', 'organisation', 'wissen'];

describe('Menüstand', () => {
	it('liest und schreibt', () => {
		const s = { zu: true, offen: ['aktuelles', 'wissen'] };
		expect(menueLesen(menueWert(s), ERLAUBT)).toEqual({ ...s, gemerkt: true });
		expect(menueLesen(menueWert({ zu: false, offen: [] }), ERLAUBT)).toEqual({
			zu: false,
			offen: [],
			gemerkt: true
		});
	});
	it('ohne Cookie: je nach Breite, nichts aufgeklappt', () => {
		expect(menueLesen(undefined, ERLAUBT)).toEqual({ zu: null, offen: [], gemerkt: false });
		expect(menueLesen('', ERLAUBT)).toEqual({ zu: null, offen: [], gemerkt: true });
	});
	it('verwirft Unbekanntes und Doppeltes', () => {
		expect(menueLesen('x|aktuelles.<script>.aktuelles.wissen', ERLAUBT)).toEqual({
			zu: null,
			offen: ['aktuelles', 'wissen'],
			gemerkt: true
		});
	});
});
