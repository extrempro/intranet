/**
 * E-Mail per SMTP (Kap. 11.1): Einstellungen prüfen und mit der .env
 * zusammenführen. Ohne Ein-/Ausgabe, damit testbar.
 *
 * Gespeichert (Verwaltung → Benachrichtigungen) gilt vor der .env; leere
 * Felder nehmen den Wert aus der .env. Das Passwort wird verschlüsselt
 * gespeichert (ENCRYPTION_KEY) und nie wieder angezeigt.
 */

export type SmtpSecurity = 'starttls' | 'tls' | 'none';
export const SMTP_SECURITY: { key: SmtpSecurity; label: string; port: number }[] = [
	{ key: 'starttls', label: 'STARTTLS (meist Port 587)', port: 587 },
	{ key: 'tls', label: 'TLS (meist Port 465)', port: 465 },
	{ key: 'none', label: 'Ohne Verschlüsselung (interner Relay, meist Port 25)', port: 25 }
];

/** In der Einstellung „mail“ gespeichert */
export interface StoredMail {
	host?: string;
	port?: number;
	security?: SmtpSecurity;
	user?: string;
	/** encryptSecret(...) */
	passwordEnc?: string;
	from?: string;
	fromName?: string;
	replyTo?: string;
	/** Zertifikat nicht prüfen (nur ausdrücklich) */
	insecure?: boolean;
}

export interface MailEnv {
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_SECURITY?: string;
	SMTP_USER?: string;
	SMTP_PASSWORD?: string;
	MAIL_FROM?: string;
	/** Früherer Name (Versand über Graph) – gilt weiter als Absender */
	MAIL_SENDER?: string;
	MAIL_FROM_NAME?: string;
	MAIL_REPLY_TO?: string;
}

export interface EffectiveMail {
	host: string | null;
	port: number;
	security: SmtpSecurity;
	user: string | null;
	/** Woher das Passwort kommt; der Wert selbst steht nicht hier */
	password: 'gespeichert' | 'env' | null;
	from: string | null;
	fromName: string | null;
	replyTo: string | null;
	insecure: boolean;
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const HOST =
	/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$|^\d{1,3}(\.\d{1,3}){3}$|^\[[0-9a-f:.]+\]$/i;

const clean = (v: string | undefined | null) => {
	const t = v?.trim();
	return t ? t : null;
};
const isSecurity = (v: unknown): v is SmtpSecurity =>
	v === 'starttls' || v === 'tls' || v === 'none';

export function effectiveMail(stored: StoredMail, env: MailEnv): EffectiveMail {
	const security =
		stored.security ?? (isSecurity(env.SMTP_SECURITY) ? env.SMTP_SECURITY : 'starttls');
	const envPort = Number(env.SMTP_PORT);
	const port =
		stored.port ??
		(Number.isInteger(envPort) && envPort > 0 && envPort < 65536
			? envPort
			: (SMTP_SECURITY.find((s) => s.key === security)?.port ?? 587));
	return {
		host: clean(stored.host) ?? clean(env.SMTP_HOST),
		port,
		security,
		user: clean(stored.user) ?? clean(env.SMTP_USER),
		password: stored.passwordEnc ? 'gespeichert' : clean(env.SMTP_PASSWORD) ? 'env' : null,
		from: clean(stored.from) ?? clean(env.MAIL_FROM) ?? clean(env.MAIL_SENDER),
		fromName: clean(stored.fromName) ?? clean(env.MAIL_FROM_NAME),
		replyTo: clean(stored.replyTo) ?? clean(env.MAIL_REPLY_TO),
		insecure: stored.insecure === true
	};
}

export type MailFormErrors = Partial<
	Record<'host' | 'port' | 'from' | 'replyTo' | 'fromName' | 'user', string>
>;

/**
 * Formular → gespeicherte Werte (ohne Passwort; das setzt der Server).
 * Leere Felder bleiben leer und nehmen damit die .env.
 */
export function parseMailForm(f: Record<string, string>): {
	werte: Omit<StoredMail, 'passwordEnc'>;
	fehler: MailFormErrors;
} {
	const fehler: MailFormErrors = {};
	const werte: Omit<StoredMail, 'passwordEnc'> = {};
	const host = clean(f.host);
	if (host) {
		if (!HOST.test(host))
			fehler.host = 'Bitte einen Servernamen wie smtp.example.de oder eine IP-Adresse.';
		else werte.host = host.toLowerCase();
	}
	const port = clean(f.port);
	if (port) {
		const n = Number(port);
		if (!Number.isInteger(n) || n < 1 || n > 65535)
			fehler.port = 'Bitte eine Zahl von 1 bis 65535.';
		else werte.port = n;
	}
	if (isSecurity(f.security)) werte.security = f.security;
	const user = clean(f.user);
	if (user) {
		if (user.length > 200) fehler.user = 'Höchstens 200 Zeichen.';
		else werte.user = user;
	}
	for (const k of ['from', 'replyTo'] as const) {
		const v = clean(f[k]);
		if (!v) continue;
		if (v.length > 254 || !EMAIL.test(v)) fehler[k] = 'Bitte eine gültige E-Mail-Adresse.';
		else werte[k] = v;
	}
	const name = clean(f.fromName);
	if (name) {
		// Zeilenumbrüche würden Kopfzeilen erlauben; nodemailer maskiert zusätzlich
		if (name.length > 80 || /[\r\n<>"]/.test(name))
			fehler.fromName = 'Höchstens 80 Zeichen, ohne < > ".';
		else werte.fromName = name;
	}
	werte.insecure = f.insecure === 'on';
	return { werte, fehler };
}

/** Fehlermeldung von SMTP für die Oberfläche: kurz, ohne Zeilenumbrüche. */
export function smtpFehlertext(err: unknown): string {
	const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
	const teile: string[] = [];
	if (e?.code === 'EAUTH')
		teile.push('Anmeldung am SMTP-Server abgelehnt (Benutzer oder Passwort).');
	else if (e?.code === 'ECONNECTION' || e?.code === 'ESOCKET' || e?.code === 'ETIMEDOUT')
		teile.push('SMTP-Server nicht erreichbar (Host, Port, Firewall).');
	else if (e?.code === 'ETLS' || /certificate|self.signed|TLS/i.test(e?.message ?? ''))
		teile.push('TLS-Fehler: Zertifikat ungültig oder Verschlüsselung passt nicht zum Port.');
	const detail = (e?.response ?? e?.message ?? '').replace(/\s+/g, ' ').slice(0, 200);
	if (detail) teile.push(detail);
	return teile.join(' ') || 'Unbekannter Fehler beim Senden.';
}
