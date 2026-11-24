import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { fortschrittAn, position } from '#lib/server/fortschritt.ts';
import { videoDetail, videosListe } from '#lib/server/mediathek.ts';
import {
	EingriffFehler,
	videoEingreifbar,
	videoZurueckziehen
} from '#lib/server/redaktion-eingriffe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const v = await videoDetail(p, params.id);
	if (!v || !['entwurf', 'veroeffentlicht'].includes(v.status)) error(404, 'Video nicht gefunden');
	const mehr = (await videosListe(p, { unitId: v.unitId, limit: 8 })).filter(
		(x) => x.id !== v.id && x.status === 'veroeffentlicht'
	);
	const an = await fortschrittAn(p.personId);
	return {
		v,
		mehr: mehr.slice(0, 4),
		/** „Weiter, wo du warst“: am Konto oder (Schalter aus) nur im Browser */
		fortschritt: { amKonto: an, sek: an ? await position(p, v.id) : null },
		// Redaktion: veröffentlichtes Video zurückziehen (Kap. 10)
		zurueckziehen: !v.darf && (await videoEingreifbar(p, v.id))
	};
};

export const actions: Actions = {
	zurueckziehen: async ({ locals, params, getClientAddress }) => {
		try {
			await videoZurueckziehen(requirePrincipal(locals), params.id, getClientAddress());
		} catch (err) {
			if (err instanceof EingriffFehler) return fail(400, { fehler: err.message });
			throw err;
		}
		redirect(303, '/mediathek');
	}
};
