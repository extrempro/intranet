import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { schreibbareEinheiten, videosListe } from '#lib/server/mediathek.ts';
import { alleThemen } from '#lib/server/themen.ts';
import type { PageServerLoad } from './$types';

/** Mediathek: alle Videos, die die Person sehen darf (Kap. 8.15). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const q = url.searchParams.get('q') ?? '';
	const einheit = url.searchParams.get('einheit') ?? '';
	const thema = url.searchParams.get('thema') ?? '';
	const [videos, alle, themen, schreibbar] = await Promise.all([
		videosListe(p, { q, unitId: einheit || null, thema: thema || null }),
		videosListe(p, {}),
		alleThemen(),
		schreibbareEinheiten(p)
	]);
	const einheiten = [
		...new Map(alle.map((v) => [v.unitId, { id: v.unitId, name: v.unitName }])).values()
	].sort((a, b) => a.name.localeCompare(b.name, 'de'));
	return {
		videos,
		einheiten,
		themen,
		filter: { q, einheit, thema },
		darfHochladen: schreibbar.length > 0
	};
};
