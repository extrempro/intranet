import { describe, expect, it } from 'vitest';
import { effectiveMail, parseMailForm, smtpFehlertext } from './mail-config.ts';

describe('E-Mail-Einstellungen', () => {
	it('gespeichert vor .env, leer nimmt die .env', () => {
		const m = effectiveMail(
			{ host: 'smtp.intern.test', from: 'intranet@haus-a.test' },
			{ SMTP_HOST: 'alt.test', SMTP_USER: 'u', SMTP_PASSWORD: 'p', MAIL_REPLY_TO: 'it@haus-a.test' }
		);
		expect(m).toMatchObject({
			host: 'smtp.intern.test',
			port: 587,
			security: 'starttls',
			user: 'u',
			password: 'env',
			from: 'intranet@haus-a.test',
			replyTo: 'it@haus-a.test',
			insecure: false
		});
		expect(effectiveMail({ security: 'tls' }, {}).port).toBe(465);
		expect(effectiveMail({}, { SMTP_SECURITY: 'none', SMTP_PORT: '2525' })).toMatchObject({
			security: 'none',
			port: 2525
		});
		expect(effectiveMail({ passwordEnc: 'v1.x' }, { SMTP_PASSWORD: 'p' }).password).toBe(
			'gespeichert'
		);
	});

	it('prüft das Formular', () => {
		const ok = parseMailForm({
			host: 'SMTP.Office365.com',
			port: '587',
			security: 'starttls',
			user: 'intranet@haus-a.test',
			from: 'intranet@haus-a.test',
			fromName: 'Intranet Beispielhaus',
			replyTo: ''
		});
		expect(ok.fehler).toEqual({});
		expect(ok.werte).toMatchObject({
			host: 'smtp.office365.com',
			port: 587,
			fromName: 'Intranet Beispielhaus'
		});
		expect(ok.werte.replyTo).toBeUndefined();

		const bad = parseMailForm({
			host: 'smtp example',
			port: '99999',
			from: 'keine-adresse',
			fromName: 'Böse\r\nBcc: x@y.z',
			security: 'quatsch'
		});
		expect(Object.keys(bad.fehler).sort()).toEqual(['from', 'fromName', 'host', 'port']);
		expect(bad.werte.security).toBeUndefined();
	});

	it('übersetzt SMTP-Fehler', () => {
		expect(
			smtpFehlertext({ code: 'EAUTH', response: '535 5.7.3 Authentication unsuccessful' })
		).toBe(
			'Anmeldung am SMTP-Server abgelehnt (Benutzer oder Passwort). 535 5.7.3 Authentication unsuccessful'
		);
		expect(smtpFehlertext({ code: 'ECONNECTION', message: 'connect ECONNREFUSED' })).toContain(
			'nicht erreichbar'
		);
	});
});
