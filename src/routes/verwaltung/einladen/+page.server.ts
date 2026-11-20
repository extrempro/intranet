import { fail } from '@sveltejs/kit';
import { canAdministerTenant, canSeeAdministration } from '#lib/server/auth/access.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import { inviteLocalPerson } from '#lib/server/auth/local.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import type { Actions, PageServerLoad } from './$types';

const MESSAGES = {
	unknown_domain: 'Diese E-Mail-Domain ist keinem Mandanten zugeordnet.',
	forbidden: 'Du darfst nur Konten in deinem eigenen Mandanten anlegen.',
	exists: 'Für diese E-Mail-Adresse gibt es schon ein Konto.',
	mail_failed:
		'Das Konto ist angelegt, aber die E-Mail konnte nicht gesendet werden. Prüf den Absender und versuch es noch einmal.'
} as const;

export const load: PageServerLoad = async () => ({ mailBereit: await mailConfigured() });

export const actions: Actions = {
	default: async ({ request, locals, url, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		requireThat(canSeeAdministration(principal));

		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.slice(0, 320);
		const name = String(form.get('name') ?? '')
			.trim()
			.slice(0, 200);
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
			return fail(400, {
				email,
				name,
				fehler: 'Gib bitte Name und eine gültige E-Mail-Adresse ein.'
			});
		}

		const result = await inviteLocalPerson({
			email,
			displayName: name,
			invitedBy: principal.personId,
			origin: url.origin,
			ip: getClientAddress(),
			mayInvite: (tenantId) => canAdministerTenant(principal, tenantId)
		});
		if (!result.ok) return fail(400, { email, name, fehler: MESSAGES[result.reason] });
		return { gesendet: email };
	}
};
