import { fail, redirect } from '@sveltejs/kit';
import { allowResetRequest, requestPasswordReset, resetAvailable } from '#lib/server/auth/reset.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.person) redirect(303, '/');
	return { verfuegbar: await resetAvailable() };
};

export const actions: Actions = {
	default: async ({ request, getClientAddress, url }) => {
		if (!(await resetAvailable())) return fail(503, { fehler: 'Nicht eingerichtet.' });
		const ip = getClientAddress();
		if (!allowResetRequest(ip))
			return fail(429, {
				fehler: 'Zu viele Anfragen. Versuch es bitte in einer Stunde noch einmal.'
			});
		const email = String((await request.formData()).get('email') ?? '').trim();
		// Im Hintergrund: gleiche Antwort und Laufzeit, ob es die Adresse gibt oder nicht
		void requestPasswordReset(email, url.origin, ip);
		return { gesendet: true };
	}
};
