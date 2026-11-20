import { error, fail } from '@sveltejs/kit';
import { canAdministerTenant, isAnyAdmin, loadRoles } from '#lib/server/auth/access.ts';
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

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.person) error(401);
	const roles = await loadRoles(locals.person.id);
	if (!isAnyAdmin(roles)) error(403, 'Dafür fehlt dir das Recht.');
	return { mailBereit: await mailConfigured() };
};

export const actions: Actions = {
	default: async ({ request, locals, url, getClientAddress }) => {
		if (!locals.person) error(401);
		const roles = await loadRoles(locals.person.id);
		if (!isAnyAdmin(roles)) error(403, 'Dafür fehlt dir das Recht.');

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
			invitedBy: locals.person.id,
			origin: url.origin,
			ip: getClientAddress(),
			mayInvite: (tenantId) => canAdministerTenant(roles, tenantId)
		});
		if (!result.ok) return fail(400, { email, name, fehler: MESSAGES[result.reason] });
		return { gesendet: email };
	}
};
