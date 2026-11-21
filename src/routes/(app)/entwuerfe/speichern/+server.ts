import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	darfEntwurf,
	EntwurfFehler,
	entwurfSpeichern,
	felderAusForm,
	istEntwurfArt
} from '#lib/server/entwuerfe.ts';
import { draftLimit } from '#lib/server/rate-limit.ts';

/**
 * Entwurf speichern (automatisch beim Schreiben oder per Knopf). Erwartet die
 * Felder des Formulars plus `art` und ggf. `entwurf` (ID). Antwort: { id }.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const p = requirePrincipal(locals);
	if (Number(request.headers.get('content-length') ?? 0) > 1024 * 1024)
		return json({ fehler: 'Der Entwurf ist zu groß.' }, { status: 413 });
	const form = await request.formData().catch(() => null);
	const art = form?.get('art');
	if (!form || !istEntwurfArt(art)) error(400, 'Ungültige Anfrage.');
	if (!darfEntwurf(p, art)) error(403, 'Dafür fehlt dir das Recht.');
	if (!draftLimit.hit(p.personId))
		return json(
			{ fehler: 'Zu viele Speicherungen. Versuch es gleich noch einmal.' },
			{ status: 429 }
		);
	try {
		const id = await entwurfSpeichern(
			p,
			art,
			String(form.get('entwurf') ?? '') || null,
			felderAusForm(form)
		);
		return json({ id });
	} catch (err) {
		if (err instanceof EntwurfFehler) return json({ fehler: err.message }, { status: 400 });
		throw err;
	}
};
