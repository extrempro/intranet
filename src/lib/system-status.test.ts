import { describe, expect, it } from 'vitest';
import {
	bewerteSicherung,
	groesse,
	leseListe,
	leseSicherung,
	leseTest,
	type LetzteSicherung,
	type LetzterTest
} from './system-status.ts';

const JETZT = Date.UTC(2026, 10, 21, 9, 0);
const s = (n: number) => Math.floor(JETZT / 1000) - n * 3600;

const sicherung = (x: Partial<LetzteSicherung> = {}): LetzteSicherung => ({
	zeit: '',
	ok: true,
	name: '2026-11-21_011500',
	dauer_s: 5,
	meldung: '',
	erfolg_epoch: s(8),
	aufbewahrung_tage: 30,
	test_alle_tage: 7,
	uhrzeit: '01:15',
	empfaenger: 1,
	...x
});
const test = (x: Partial<LetzterTest> = {}): LetzterTest => ({
	zeit: '',
	epoch: s(48),
	ok: true,
	name: '',
	dauer_s: 3,
	tabellen: 53,
	personen: 5,
	dateien: 20,
	fehlende_dateien: 0,
	meldung: '',
	...x
});

describe('Bewertung der Sicherung', () => {
	it('alles in Ordnung', () => {
		expect(bewerteSicherung(sicherung(), test(), JETZT)).toEqual([]);
	});
	it('ohne Sicherung', () => {
		expect(bewerteSicherung(null, null, JETZT)[0].stufe).toBe('fehler');
	});
	it('fehlgeschlagen und veraltet', () => {
		const b = bewerteSicherung(
			sicherung({ ok: false, meldung: 'pg_dump ist fehlgeschlagen.', erfolg_epoch: s(30) }),
			test(),
			JETZT
		);
		expect(b.map((x) => x.stufe)).toEqual(['fehler', 'fehler']);
		expect(b[0].text).toContain('pg_dump');
	});
	it('25 Stunden sind noch in Ordnung, 27 nicht', () => {
		expect(bewerteSicherung(sicherung({ erfolg_epoch: s(25) }), test(), JETZT)).toEqual([]);
		expect(bewerteSicherung(sicherung({ erfolg_epoch: s(27) }), test(), JETZT)).toHaveLength(1);
	});
	it('Test: fehlgeschlagen ist Fehler, fehlende Dateien und Alter sind Warnungen', () => {
		expect(bewerteSicherung(sicherung(), test({ ok: false }), JETZT)[0].stufe).toBe('fehler');
		expect(
			bewerteSicherung(sicherung(), test({ fehlende_dateien: 1, meldung: '1 fehlt' }), JETZT)[0]
		).toEqual({ stufe: 'warnung', text: '1 fehlt' });
		expect(bewerteSicherung(sicherung(), test({ epoch: s(24 * 9) }), JETZT)[0].stufe).toBe(
			'warnung'
		);
		expect(bewerteSicherung(sicherung(), null, JETZT)[0].stufe).toBe('warnung');
	});
});

describe('Statusdateien lesen', () => {
	it('nimmt nur bekannte Felder mit passendem Typ', () => {
		const x = leseSicherung({ ok: 'true', erfolg_epoch: '5', meldung: 7, name: 'a', fremd: 1 });
		expect(x).toMatchObject({ ok: false, erfolg_epoch: 0, meldung: '', name: 'a' });
		expect(x).not.toHaveProperty('fremd');
		expect(leseSicherung(null)).toBeNull();
		expect(leseTest('kaputt')).toBeNull();
	});
	it('Liste nur mit gültigen Namen', () => {
		const l = leseListe([
			{ name: '2026-11-21_011500', db_bytes: 10, dateien: 2, dateien_bytes: 30 },
			{ name: '../etc' },
			null
		]);
		expect(l.map((e) => e.name)).toEqual(['2026-11-21_011500']);
		expect(leseListe({})).toEqual([]);
	});
});

describe('Größe', () => {
	it('formatiert deutsch', () => {
		expect(groesse(512)).toBe('512 B');
		expect(groesse(1536)).toBe('1,5 KB');
		expect(groesse(250 * 1024 * 1024)).toBe('250 MB');
	});
});
