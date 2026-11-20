import { fail, redirect } from '@sveltejs/kit';
import { passwordMessage } from '#lib/password.ts';
import {
	acceptInvitation,
	checkNewPassword,
	findInvitation,
	passwordPolicy,
	startPending
} from '#lib/server/auth/local.ts';
import { audit } from '#lib/server/audit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (locals.person) redirect(303, '/');
	const invitation = await findInvitation(params.token);
	return {
		gueltig: invitation !== null,
		name: invitation?.displayName ?? '',
		email: invitation?.email ?? '',
		min: (await passwordPolicy()).minLength
	};
};

export const actions: Actions = {
	default: async ({ params, request, cookies, getClientAddress }) => {
		const invitation = await findInvitation(params.token);
		if (!invitation) return fail(410, { fehler: 'Diese Einladung gilt nicht mehr.' });

		const form = await request.formData();
		const password = String(form.get('passwort') ?? '');
		const repeat = String(form.get('wiederholung') ?? '');
		const ip = getClientAddress();

		const problem = await checkNewPassword(password, repeat, {
			personId: invitation.personId,
			ip
		});
		if (problem)
			return fail(400, { fehler: passwordMessage(problem, (await passwordPolicy()).minLength) });

		if (!(await acceptInvitation(params.token, invitation.personId, password))) {
			return fail(410, { fehler: 'Diese Einladung gilt nicht mehr.' });
		}
		await audit({
			category: 'security',
			action: 'invitation.accepted',
			actorId: invitation.personId,
			ip
		});
		await startPending(cookies, invitation.personId, 'setup', '/');
		redirect(303, '/anmelden/einrichten');
	}
};
