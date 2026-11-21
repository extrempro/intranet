import { fail, redirect } from '@sveltejs/kit';
import { safeReturnTo } from '#lib/server/auth/entra.ts';
import {
	bestaetigtBis,
	bestaetigungsWege,
	mitCodeBestaetigen
} from '#lib/server/auth/bestaetigung.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import type { Actions, PageServerLoad } from './$types';

/** Erneute Anmeldung vor kritischen Verwaltungsaktionen (auch ohne JavaScript nutzbar) */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePrincipal(locals);
	return {
		wege: await bestaetigungsWege(locals),
		bis: bestaetigtBis(locals)?.toISOString() ?? null,
		ziel: safeReturnTo(url.searchParams.get('ziel') ?? '/verwaltung'),
		fehler: url.searchParams.has('fehler')
	};
};

export const actions: Actions = {
	code: async ({ locals, request, url, getClientAddress }) => {
		requirePrincipal(locals);
		const f = await request.formData();
		const r = await mitCodeBestaetigen(locals, String(f.get('code') ?? ''), getClientAddress());
		if (!r.ok) {
			const fehler =
				r.grund === 'warten'
					? `Zu viele Fehlversuche. Warte bitte ${r.sekunden} Sekunden.`
					: r.grund === 'nicht_moeglich'
						? 'Hier kannst du dich nicht mit einem Code bestätigen.'
						: 'Der Code stimmt nicht.';
			return fail(400, { codeFehler: fehler });
		}
		// Im Dialog bleibt die Seite stehen, sonst zurück zum Ziel
		if (f.get('dialog') === '1') return { bis: r.bis.toISOString() };
		redirect(303, safeReturnTo(String(f.get('ziel') ?? url.searchParams.get('ziel') ?? '/')));
	}
};
