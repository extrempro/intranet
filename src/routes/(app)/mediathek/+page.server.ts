import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import { schreibbareEinheiten, videoEinheiten, videosListe } from '#lib/server/mediathek.ts';
import { weiterAnsehen } from '#lib/server/fortschritt.ts';
import { alleThemen } from '#lib/server/themen.ts';
import type { PageServerLoad } from './$types';

/** Videos je Schritt „weitere anzeigen“ (Kap. 6.7) */
const SCHRITT = 24;

/** Mediathek: alle Videos, die die Person sehen darf (Kap. 8.15). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const q = url.searchParams.get('q') ?? '';
	const einheit = url.searchParams.get('einheit') ?? '';
	const thema = url.searchParams.get('thema') ?? '';
	const anzahl = anzahlAus(url, SCHRITT, 2000);
	const filter = { q, unitId: einheit || null, thema: thema || null };
	const [videos, inArbeit, einheiten, themen, schreibbar, weiter] = await Promise.all([
		videosListe(p, { ...filter, nur: 'veroeffentlicht', limit: anzahl }),
		videosListe(p, { ...filter, nur: 'inArbeit', limit: 200 }),
		videoEinheiten(p),
		alleThemen(),
		schreibbareEinheiten(p),
		q || einheit || thema ? [] : weiterAnsehen(p)
	]);
	return {
		videos,
		inArbeit,
		gesamt: videos[0]?.gesamt ?? 0,
		anzahl,
		schritt: SCHRITT,
		weiter,
		einheiten,
		themen,
		filter: { q, einheit, thema },
		darfHochladen: schreibbar.length > 0
	};
};
