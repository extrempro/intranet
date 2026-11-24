import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { hubBildEntfernen, hubBildSetzen, type HubBild } from '#lib/server/hub-inhalte.ts';
import {
	dokumenteSpeichern,
	hubDatenLesen,
	hubPflegeDaten,
	hubSpeichern
} from '#lib/server/hub-pflege.ts';
import { archiveHub, getHub, HubError } from '#lib/server/hubs.ts';
import { uploadLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug);
	if (!hub || !(hub.canManage || hub.canDocs))
		error(404, 'Diesen Hub gibt es nicht oder du darfst ihn nicht bearbeiten.');
	return { hub, pflege: hub.canManage ? await hubPflegeDaten(p, hub.id) : null };
};

async function hubId(locals: App.Locals, slug: string) {
	const hub = await getHub(requirePrincipal(locals), slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht.');
	return hub.id;
}

export const actions: Actions = {
	/** Alles auf einmal (Hub-Team, Verwaltung, Redaktion ohne Hub-Team) */
	speichern: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		try {
			const r = await hubSpeichern(
				p,
				id,
				hubDatenLesen(String(f.get('daten') ?? '')),
				String(f.get('ueber') ?? '').slice(0, 200_000),
				f.getAll('anhaenge').map(String).slice(0, 20),
				getClientAddress()
			);
			if (r.fehler) return fail(400, { bereich: 'seite', fehler: r.fehler });
		} catch (err) {
			if (err instanceof HubError) return fail(400, { bereich: 'seite', fehler: err.message });
			throw err;
		}
		return { bereich: 'seite', ok: 'Gespeichert.' };
	},
	/** Nur Dokumente (Personen mit dem Recht „Dokumente“) */
	dokumente: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const hub = await getHub(p, params.slug);
		if (!hub) error(404, 'Diesen Hub gibt es nicht.');
		// Recht auch hier prüfen (zusätzlich zu dokumenteSpeichern)
		if (!hub.canDocs) return fail(403, { bereich: 'seite', fehler: 'Dafür fehlt dir das Recht.' });
		const id = hub.id;
		try {
			await dokumenteSpeichern(
				p,
				id,
				hubDatenLesen(String(f.get('daten') ?? '{}')).dokumente,
				f.getAll('anhaenge').map(String).slice(0, 20)
			);
		} catch (err) {
			if (err instanceof HubError) return fail(400, { bereich: 'seite', fehler: err.message });
			throw err;
		}
		return { bereich: 'seite', ok: 'Gespeichert.' };
	},
	bild: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		if (!uploadLimit.hit(p.personId))
			return fail(429, { bereich: 'bilder', fehler: 'Zu viele Uploads. Versuch es später.' });
		const f = await request.formData();
		const art: HubBild = f.get('art') === 'symbol' ? 'symbol' : 'titelbild';
		const id = await hubId(locals, params.slug);
		try {
			await hubBildSetzen(p, id, art, f.get('foto'), getClientAddress());
		} catch (err) {
			if (err instanceof HubError) return fail(400, { bereich: 'bilder', fehler: err.message });
			throw err;
		}
		return {
			bereich: 'bilder',
			ok: art === 'symbol' ? 'Symbol gespeichert.' : 'Titelbild gespeichert.'
		};
	},
	bildLoeschen: async ({ request, locals, params, getClientAddress }) => {
		const art: HubBild =
			(await request.formData()).get('art') === 'symbol' ? 'symbol' : 'titelbild';
		const id = await hubId(locals, params.slug);
		try {
			await hubBildEntfernen(requirePrincipal(locals), id, art, getClientAddress());
		} catch (err) {
			if (err instanceof HubError) return fail(400, { bereich: 'bilder', fehler: err.message });
			throw err;
		}
		return { bereich: 'bilder', ok: art === 'symbol' ? 'Symbol entfernt.' : 'Titelbild entfernt.' };
	},
	archivieren: async ({ locals, params, getClientAddress }) => {
		const id = await hubId(locals, params.slug);
		try {
			await archiveHub(requirePrincipal(locals), id, getClientAddress());
		} catch (err) {
			if (err instanceof HubError) return fail(400, { bereich: 'archiv', fehler: err.message });
			throw err;
		}
		redirect(303, '/hubs');
	}
};
