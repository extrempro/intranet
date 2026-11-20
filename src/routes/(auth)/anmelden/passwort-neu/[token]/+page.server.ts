import { fail, redirect } from '@sveltejs/kit';
import { passwordMessage } from '#lib/password.ts';
import { checkNewPassword, passwordPolicy } from '#lib/server/auth/local.ts';
import { completeReset, findReset } from '#lib/server/auth/reset.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	if (locals.person) redirect(303, '/');
	// Token steht in der Adresse: nicht zwischenspeichern
	setHeaders({ 'Cache-Control': 'no-store' });
	const reset = await findReset(params.token);
	return {
		gueltig: reset !== null,
		email: reset?.email ?? '',
		min: (await passwordPolicy()).minLength
	};
};

export const actions: Actions = {
	default: async ({ params, request, getClientAddress }) => {
		const reset = await findReset(params.token);
		const abgelaufen = 'Dieser Link gilt nicht mehr. Fordere bitte einen neuen an.';
		if (!reset) return fail(410, { fehler: abgelaufen });

		const form = await request.formData();
		const password = String(form.get('passwort') ?? '');
		const repeat = String(form.get('wiederholung') ?? '');
		const ip = getClientAddress();
		const problem = await checkNewPassword(password, repeat, { personId: reset.personId, ip });
		if (problem)
			return fail(400, { fehler: passwordMessage(problem, (await passwordPolicy()).minLength) });

		if (!(await completeReset(params.token, reset.personId, password, ip)))
			return fail(410, { fehler: abgelaufen });
		redirect(303, '/anmelden?passwort-geaendert');
	}
};
