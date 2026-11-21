import { fail, redirect } from '@sveltejs/kit';
import { safeReturnPath, technikAusEingabe } from '#lib/feedback.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { createFeedback } from '#lib/server/feedback.ts';
import { setFlash } from '#lib/server/flash.ts';
import { feedbackLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePrincipal(locals);
	return { von: safeReturnPath(url.searchParams.get('von')) };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const input = {
			kind: String(f.get('art') ?? ''),
			text: String(f.get('text') ?? '').slice(0, 4000),
			page: String(f.get('seite') ?? '').slice(0, 500)
		};
		// Aus dem Fenster (Kopfzeile): Ergebnis zurück statt Weiterleitung
		const imFenster = f.get('fenster') === '1';
		if (!feedbackLimit.hit(p.personId))
			return fail(429, {
				fehler: {
					text: 'Du hast in der letzten Stunde schon viele Rückmeldungen geschickt. Danke! Versuch es bitte später noch einmal.'
				} as { kind?: string; text?: string },
				eingabe: input
			});
		// Nur bei Fehlern: technische Angaben (Browser aus dem Header) und Bildschirmfoto
		const bild = f.get('bildschirmfoto');
		const r = await createFeedback(
			p,
			input,
			input.kind === 'fehler'
				? {
						technik: technikAusEingabe(
							String(f.get('technik') ?? ''),
							request.headers.get('user-agent')
						),
						screenshot:
							bild instanceof File && bild.size > 0
								? new Uint8Array(await bild.arrayBuffer())
								: null
					}
				: undefined
		);
		if (!r.ok) return fail(400, { fehler: r.errors, eingabe: input });
		if (imFenster) return { gesendet: true };
		setFlash(cookies, 'rueckmeldung');
		// Nach dem Senden zurück zur Ausgangsseite (Kap. 13)
		redirect(303, safeReturnPath(input.page));
	}
};
