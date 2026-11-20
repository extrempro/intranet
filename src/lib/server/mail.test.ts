/** Versand gegen einen lokalen SMTP-Server (smtp-server): Anmeldung, Absender, Antworten an. */
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StoredMail } from '../mail-config.ts';

let stored: StoredMail = {};
vi.mock('./settings.ts', () => ({ getSetting: async () => stored }));

const empfangen: { from: string; to: string[]; data: string }[] = [];
let server: SMTPServer;
let port = 0;

describe('E-Mail per SMTP', () => {
	beforeAll(async () => {
		process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
		server = new SMTPServer({
			authOptional: false,
			allowInsecureAuth: true,
			disabledCommands: ['STARTTLS'],
			onAuth(auth, _s, cb) {
				if (auth.username === 'intranet' && auth.password === 'geheim ü 123')
					cb(null, { user: 'intranet' });
				else cb(new Error('535 Authentication failed'));
			},
			onData(stream, session, cb) {
				let data = '';
				stream.on('data', (c) => (data += c));
				stream.on('end', () => {
					empfangen.push({
						from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
						to: session.envelope.rcptTo.map((r) => r.address),
						data
					});
					cb();
				});
			}
		});
		await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
		port = (server.server.address() as AddressInfo).port;
	});
	afterAll(async () => {
		const { resetMailTransport } = await import('./mail.ts');
		resetMailTransport();
		await new Promise<void>((r) => server.close(() => r()));
	});

	it('sendet mit gespeichertem, verschlüsseltem Passwort', async () => {
		const { encryptSecret } = await import('./crypto.ts');
		stored = {
			host: '127.0.0.1',
			port,
			security: 'none',
			user: 'intranet',
			passwordEnc: encryptSecret(new TextEncoder().encode('geheim ü 123')),
			from: 'intranet@oper.test',
			fromName: 'Intranet Staatsoper',
			replyTo: 'it@oper.test'
		};
		const { sendMail, mailConfigured } = await import('./mail.ts');
		expect(await mailConfigured()).toBe(true);
		await sendMail({ to: 'kai@oper.test', subject: 'Hallo', text: 'Text', html: '<p>Text</p>' });
		expect(empfangen).toHaveLength(1);
		expect(empfangen[0]).toMatchObject({ from: 'intranet@oper.test', to: ['kai@oper.test'] });
		expect(empfangen[0].data).toContain('Reply-To: it@oper.test');
		expect(empfangen[0].data).toMatch(/From: "?Intranet Staatsoper"? <intranet@oper.test>/);
	});

	it('meldet falsches Passwort verständlich', async () => {
		const { encryptSecret } = await import('./crypto.ts');
		stored = { ...stored, passwordEnc: encryptSecret(new TextEncoder().encode('falsch')) };
		const { sendMail } = await import('./mail.ts');
		const { smtpFehlertext } = await import('../mail-config.ts');
		const err = await sendMail({ to: 'kai@oper.test', subject: 'x', text: 'x', html: 'x' }).catch(
			(e) => e
		);
		expect(smtpFehlertext(err)).toContain('Anmeldung am SMTP-Server abgelehnt');
	});

	it('STARTTLS ist Pflicht, wenn gewählt', async () => {
		stored = { ...stored, security: 'starttls' };
		const { sendMail } = await import('./mail.ts');
		await expect(
			sendMail({ to: 'kai@oper.test', subject: 'x', text: 'x', html: 'x' })
		).rejects.toBeTruthy();
		expect(empfangen).toHaveLength(1);
	});
});
