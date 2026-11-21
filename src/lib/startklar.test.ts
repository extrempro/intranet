import { describe, expect, it } from 'vitest';
import { bewerteStartklar, istInterneAdresse, type StartklarEingaben } from './startklar.ts';

const JETZT = Date.UTC(2026, 10, 21, 12, 0);

const gut = (x: Partial<StartklarEingaben> = {}): StartklarEingaben => ({
	origin: 'https://intranet.example.de',
	addressHeader: 'X-Forwarded-For',
	erkannteAdresse: '203.0.113.7',
	entra: true,
	abgleich: { ok: true, zeit: new Date(JETZT - 10 * 3_600_000).toISOString() },
	lokaleSystemAdmins: 1,
	mail: true,
	sicherung: { eingerichtet: true, befunde: [] },
	push: true,
	rechtliches: { datenschutz: true, impressum: true },
	teams: { aktiv: true, letzte: { ok: true, meldung: '' } },
	migrationen: { vorhanden: 33, eingespielt: 33 },
	...x
});

const stufe = (e: StartklarEingaben, id: string) =>
	bewerteStartklar(e, JETZT).find((p) => p.id === id)?.stufe;

describe('Startklar', () => {
	it('alles eingerichtet: nur grün', () => {
		expect(bewerteStartklar(gut(), JETZT).every((p) => p.stufe === 'ok')).toBe(true);
	});

	it('Adresse ohne https ist ein Fehler', () => {
		expect(stufe(gut({ origin: 'http://intranet' }), 'origin')).toBe('fehler');
		expect(stufe(gut({ origin: null }), 'origin')).toBe('fehler');
	});

	it('Proxy: ohne Header oder mit interner Adresse ein Hinweis', () => {
		expect(stufe(gut({ addressHeader: null }), 'proxy')).toBe('warnung');
		expect(stufe(gut({ erkannteAdresse: '172.18.0.1' }), 'proxy')).toBe('warnung');
		expect(stufe(gut({ erkannteAdresse: '100.92.1.4' }), 'proxy')).toBe('warnung');
	});

	it('erkennt interne Adressen', () => {
		for (const a of ['10.1.2.3', '127.0.0.1', '192.168.1.1', '172.31.0.1', '::1', 'fd00::1'])
			expect(istInterneAdresse(a), a).toBe(true);
		for (const a of ['203.0.113.7', '172.32.0.1', '2001:db8::1', '::ffff:8.8.8.8'])
			expect(istInterneAdresse(a), a).toBe(false);
	});

	it('Entra: fehlgeschlagener oder alter Abgleich', () => {
		expect(stufe(gut({ abgleich: { ok: false, zeit: '' } }), 'entra')).toBe('fehler');
		const alt = new Date(JETZT - 30 * 3_600_000).toISOString();
		expect(stufe(gut({ abgleich: { ok: true, zeit: alt } }), 'entra')).toBe('warnung');
		expect(stufe(gut({ abgleich: null }), 'entra')).toBe('warnung');
	});

	it('ohne Notfallzugang, SMTP und Sicherung', () => {
		expect(stufe(gut({ lokaleSystemAdmins: 0 }), 'notfall')).toBe('warnung');
		expect(stufe(gut({ mail: false }), 'mail')).toBe('fehler');
		expect(stufe(gut({ sicherung: { eingerichtet: false, befunde: [] } }), 'sicherung')).toBe(
			'fehler'
		);
		const veraltet = { stufe: 'warnung' as const, text: 'Test veraltet' };
		const p = bewerteStartklar(
			gut({ sicherung: { eingerichtet: true, befunde: [veraltet] } }),
			JETZT
		);
		expect(p.find((x) => x.id === 'sicherung')).toMatchObject({
			stufe: 'warnung',
			text: 'Test veraltet'
		});
	});

	it('Teams: aus ist nur Info, fehlgeschlagene Meldung ein Fehler', () => {
		expect(stufe(gut({ teams: { aktiv: false, letzte: null } }), 'teams')).toBe('info');
		expect(stufe(gut({ teams: { aktiv: true, letzte: null } }), 'teams')).toBe('ok');
		expect(
			stufe(gut({ teams: { aktiv: true, appId: 'x', appIdFest: false, letzte: null } }), 'teams')
		).toBe('warnung');
		expect(
			stufe(gut({ teams: { aktiv: true, appId: 'x', appIdFest: true, letzte: null } }), 'teams')
		).toBe('ok');
		expect(
			stufe(gut({ teams: { aktiv: true, letzte: { ok: false, meldung: '403' } } }), 'teams')
		).toBe('fehler');
	});

	it('fehlende Migrationen und Rechtliches', () => {
		expect(stufe(gut({ migrationen: { vorhanden: 33, eingespielt: 32 } }), 'datenbank')).toBe(
			'fehler'
		);
		expect(
			stufe(gut({ rechtliches: { datenschutz: false, impressum: true } }), 'rechtliches')
		).toBe('warnung');
	});
});
