import { fail, redirect } from '@sveltejs/kit';
import { DENIED_MESSAGES } from '#lib/server/auth/entra-login.ts';
import { getEntraConfig, safeReturnTo } from '#lib/server/auth/entra.ts';
import { loginWithPassword, startPending } from '#lib/server/auth/local.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const ziel = safeReturnTo(url.searchParams.get('ziel'));
	if (locals.person) redirect(303, ziel);

	const code = url.searchParams.get('fehler');
	const fehler =
		code && Object.hasOwn(DENIED_MESSAGES, code)
			? DENIED_MESSAGES[code as keyof typeof DENIED_MESSAGES]
			: code
				? DENIED_MESSAGES.failed
				: null;

	return {
		ziel,
		fehler,
		abgemeldet: url.searchParams.has('abgemeldet'),
		passwortGeaendert: url.searchParams.has('passwort-geaendert'),
		entraAktiv: (await getEntraConfig()) !== null
	};
};

export const actions: Actions = {
	lokal: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').slice(0, 320);
		const password = String(form.get('passwort') ?? '').slice(0, 512);
		const ziel = safeReturnTo(String(form.get('ziel') ?? url.searchParams.get('ziel') ?? '/'));
		if (!email || !password) {
			return fail(400, { email, lokalFehler: 'Gib bitte E-Mail-Adresse und Passwort ein.' });
		}

		const result = await loginWithPassword(email, password, getClientAddress());
		if (!result.ok) {
			const lokalFehler =
				result.reason === 'wait'
					? `Zu viele Fehlversuche. Warte bitte ${result.seconds} Sekunden und versuch es dann noch einmal.`
					: 'E-Mail-Adresse oder Passwort stimmen nicht.';
			return fail(result.reason === 'wait' ? 429 : 400, { email, lokalFehler });
		}

		await startPending(cookies, result.personId, result.needsSetup ? 'setup' : 'mfa', ziel);
		redirect(303, result.needsSetup ? '/anmelden/einrichten' : '/anmelden/zweiter-faktor');
	}
};
