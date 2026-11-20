import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { setTheme, type Theme } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

const THEMES: Theme[] = ['auto', 'hell', 'dunkel'];

export const load: PageServerLoad = ({ locals }) => ({ gewaehlt: locals.theme });

export const actions: Actions = {
	setzen: async ({ request, locals }) => {
		const principal = requirePrincipal(locals);
		const wert = String((await request.formData()).get('wert') ?? '') as Theme;
		if (!THEMES.includes(wert)) return fail(400, { fehler: 'Ungültige Auswahl.' });
		await setTheme(principal.personId, wert);
		return { gespeichert: true };
	},

	/** Kopfzeile: mit JS kommt der Zielwert mit, ohne JS wird umgeschaltet. */
	umschalten: async ({ request, locals }) => {
		const principal = requirePrincipal(locals);
		const wert = String((await request.formData()).get('wert') ?? '') as Theme;
		const neu =
			THEMES.includes(wert) && wert !== 'auto'
				? wert
				: locals.theme === 'dunkel'
					? 'hell'
					: 'dunkel';
		await setTheme(principal.personId, neu);
		return { gespeichert: true };
	}
};
