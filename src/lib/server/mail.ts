/**
 * E-Mail per SMTP (Kap. 11.1) mit nodemailer.
 *
 * Einstellungen: Verwaltung → Benachrichtigungen (Einstellung „mail“), sonst
 * .env (SMTP_HOST, SMTP_PORT, SMTP_SECURITY, SMTP_USER, SMTP_PASSWORD,
 * MAIL_FROM, MAIL_FROM_NAME, MAIL_REPLY_TO). Das Passwort aus der Verwaltung
 * liegt mit ENCRYPTION_KEY verschlüsselt in der Datenbank.
 *
 * Verbindung: STARTTLS (Pflicht, kein Rückfall auf unverschlüsselt), TLS oder
 * ohne Verschlüsselung für einen internen Relay. Zertifikate werden geprüft,
 * außer die Verwaltung schaltet das ausdrücklich ab.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { effectiveMail, type MailEnv, type StoredMail } from '../mail-config.ts';
import { decryptSecret } from './crypto.ts';
import { getSetting } from './settings.ts';

export interface MailMessage {
	to: string;
	subject: string;
	text: string;
	html: string;
}

export async function storedMail(): Promise<StoredMail> {
	return getSetting<StoredMail>('mail', {});
}

export async function mailSettings() {
	return effectiveMail(await storedMail(), process.env as MailEnv);
}

export async function mailConfigured(): Promise<boolean> {
	const m = await mailSettings();
	return Boolean(m.host && m.from);
}

let cache: { key: string; transport: Transporter } | null = null;

/** Nach dem Speichern in der Verwaltung: neue Verbindung aufbauen. */
export function resetMailTransport() {
	cache?.transport.close();
	cache = null;
}

async function transport(): Promise<{
	transport: Transporter;
	from: string | { name: string; address: string };
	replyTo: string | null;
}> {
	const stored = await storedMail();
	const m = effectiveMail(stored, process.env as MailEnv);
	if (!m.host || !m.from)
		throw new Error('E-Mail ist nicht eingerichtet (SMTP-Server und Absender).');
	const password =
		m.password === 'gespeichert' && stored.passwordEnc
			? Buffer.from(decryptSecret(stored.passwordEnc)).toString('utf8')
			: m.password === 'env'
				? (process.env.SMTP_PASSWORD ?? '')
				: null;
	const from = m.fromName ? { name: m.fromName, address: m.from } : m.from;
	const key = JSON.stringify([m, stored.passwordEnc ?? null]);
	if (cache?.key !== key) {
		resetMailTransport();
		cache = {
			key,
			transport: nodemailer.createTransport({
				host: m.host,
				port: m.port,
				secure: m.security === 'tls',
				requireTLS: m.security === 'starttls',
				ignoreTLS: m.security === 'none',
				auth: m.user && password !== null ? { user: m.user, pass: password } : undefined,
				tls: { rejectUnauthorized: !m.insecure, minVersion: 'TLSv1.2' },
				connectionTimeout: 10_000,
				greetingTimeout: 10_000,
				socketTimeout: 20_000,
				pool: true,
				maxConnections: 2
			})
		};
	}
	return {
		transport: cache.transport,
		// nodemailer kodiert den Namen selbst (RFC 2047)
		from,
		replyTo: m.replyTo
	};
}

export async function sendMail(msg: MailMessage): Promise<void> {
	const t = await transport();
	await t.transport.sendMail({
		from: t.from,
		to: msg.to,
		replyTo: t.replyTo ?? undefined,
		subject: msg.subject,
		text: msg.text,
		html: msg.html
	});
}

/** Text für HTML maskieren. */
export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);
}
