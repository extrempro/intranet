/**
 * E-Mail über Microsoft Graph (Kap. 11.1) aus einem festgelegten Absenderpostfach.
 *
 * Nutzt dieselbe App-Registrierung wie die Anmeldung, aber mit der
 * Anwendungsberechtigung Mail.Send (Client Credentials). Diese Berechtigung
 * muss in Exchange Online auf das Absenderpostfach beschränkt werden
 * (RBAC für Anwendungen), sonst darf die App aus jedem Postfach senden.
 *
 * Absender: Einstellung „mail“ (später in der Verwaltung), bis dahin MAIL_SENDER
 * und optional MAIL_REPLY_TO.
 */
import { getEntraConfig, graphAppToken as appToken } from './auth/entra.ts';
import { getSetting } from './settings.ts';

interface MailSettings {
	sender?: string;
	replyTo?: string;
}

export interface MailMessage {
	to: string;
	subject: string;
	text: string;
	html: string;
}

export async function mailConfigured(): Promise<boolean> {
	const s = await getSetting<MailSettings>('mail', {});
	return Boolean((s.sender ?? process.env.MAIL_SENDER) && (await getEntraConfig()));
}

export async function sendMail(msg: MailMessage): Promise<void> {
	const s = await getSetting<MailSettings>('mail', {});
	const sender = (s.sender ?? process.env.MAIL_SENDER)?.trim();
	const replyTo = (s.replyTo ?? process.env.MAIL_REPLY_TO)?.trim();
	if (!sender) throw new Error('Kein Absenderpostfach festgelegt (MAIL_SENDER)');

	const token = await appToken();
	const res = await fetch(
		`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
		{
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			signal: AbortSignal.timeout(15_000),
			redirect: 'error',
			body: JSON.stringify({
				message: {
					subject: msg.subject,
					body: { contentType: 'HTML', content: msg.html },
					toRecipients: [{ emailAddress: { address: msg.to } }],
					...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {})
				},
				saveToSentItems: false
			})
		}
	);
	if (!res.ok) throw new Error(`Graph sendMail antwortet mit ${res.status}`);
}

/** Text für HTML maskieren. */
export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);
}
