/**
 * Abteilung: nur Dokumente pflegen (Recht „Dokumente“, Kap. 8.11). Wer die
 * ganze Seite pflegt, landet unter „Bearbeiten“.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { siehtIntern } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getDepartment } from '#lib/server/departments.ts';
import { dokumenteSpeichern, hubDatenLesen } from '#lib/server/hub-pflege.ts';
import { HubError } from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const e = await getDepartment(p, params.slug);
	if (!e || !e.canDocs)
		error(404, 'Diese Abteilung gibt es nicht oder du darfst ihre Dokumente nicht pflegen.');
	if (e.canManage || e.canAdminister)
		redirect(303, `/abteilungen/${encodeURIComponent(e.slug)}/bearbeiten#dokumente`);
	return {
		einheit: {
			id: e.id,
			slug: e.slug,
			name: e.name,
			layout: e.layout,
			links: [],
			ordner: e.ordner,
			dokumente: e.dokumente,
			internOrdner: e.internOrdner,
			internDokumente: e.internDokumente,
			internErlaubt: siehtIntern(p, e.id)
		}
	};
};

export const actions: Actions = {
	dokumente: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const e = await getDepartment(p, params.slug);
		if (!e) error(404, 'Diese Abteilung gibt es nicht.');
		// Recht auch hier prüfen (zusätzlich zu dokumenteSpeichern)
		if (!e.canDocs) return fail(403, { fehler: 'Dafür fehlt dir das Recht.' });
		const f = await request.formData();
		const daten = hubDatenLesen(String(f.get('daten') ?? '{}'));
		try {
			await dokumenteSpeichern(
				p,
				e.id,
				daten.dokumente,
				f.getAll('anhaenge').map(String).slice(0, 20),
				daten.interneOrdner
			);
		} catch (err) {
			if (err instanceof HubError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { ok: 'Gespeichert.' };
	}
};
