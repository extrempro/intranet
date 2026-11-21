import { fail, redirect } from '@sveltejs/kit';
import {
	EinrichtungsFehler,
	hatMandant,
	hauptmandantAnlegen,
	pruefeLink,
	systemAdminAnlegen,
	vorbelegung
} from '#lib/server/einrichtung.ts';
import { loginLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

/** Einrichtung: Hauptmandant und erster System-Admin (Link aus dem Log, siehe einrichtung.ts) */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (locals.person) redirect(303, '/');
	const art = await pruefeLink(params.token);
	if (!art) return { gueltig: false as const };
	const mandant = await hatMandant();
	return {
		gueltig: true as const,
		art,
		schritt: art === 'erst' && !mandant ? ('mandant' as const) : ('admin' as const),
		vorbelegung: vorbelegung()
	};
};

const feld = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').slice(0, max);

export const actions: Actions = {
	mandant: async ({ params, request, getClientAddress }) => {
		const ip = getClientAddress();
		if (!loginLimit.hit(ip)) return fail(429, { fehler: 'Zu viele Versuche. Warte bitte kurz.' });
		const f = await request.formData();
		const eingabe = {
			name: feld(f, 'name'),
			kurz: feld(f, 'kurz'),
			domains: feld(f, 'domains', 2000),
			akzent: feld(f, 'akzent', 7),
			akzentDunkel: feld(f, 'akzentDunkel', 7)
		};
		try {
			await hauptmandantAnlegen(params.token, eingabe, ip);
		} catch (err) {
			if (err instanceof EinrichtungsFehler) return fail(400, { fehler: err.message, eingabe });
			throw err;
		}
		return { mandantAngelegt: true };
	},
	admin: async ({ params, request, getClientAddress }) => {
		const ip = getClientAddress();
		if (!loginLimit.hit(ip)) return fail(429, { fehler: 'Zu viele Versuche. Warte bitte kurz.' });
		const f = await request.formData();
		const person = { name: feld(f, 'anzeigename', 120), email: feld(f, 'email', 320) };
		let einladung: string;
		try {
			einladung = await systemAdminAnlegen(params.token, person, ip);
		} catch (err) {
			if (err instanceof EinrichtungsFehler) return fail(400, { fehler: err.message, person });
			throw err;
		}
		// Weiter wie bei einer Einladung: Passwort, zweiter Faktor, Wiederherstellungscodes
		redirect(303, `/einladung/${einladung}`);
	}
};
