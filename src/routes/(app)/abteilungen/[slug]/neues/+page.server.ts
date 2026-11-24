import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { abteilungSeiteActions } from '#lib/server/abteilung-seite.ts';
import { hubBeitraege } from '#lib/server/hub-seite.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import { NEWS_MAX } from '#lib/server/news.ts';
import type { PageServerLoad } from './$types';

/** Beiträge je Schritt „weitere anzeigen“ (Kap. 6.7) */
const SCHRITT = 24;

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { einheit } = await parent();
	const anzahl = anzahlAus(url, SCHRITT, NEWS_MAX);
	return {
		...(await hubBeitraege(requirePrincipal(locals), einheit.id, anzahl)),
		schritt: SCHRITT
	};
};

export const actions = abteilungSeiteActions;
