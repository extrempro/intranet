import { anzahlAus } from '#lib/lange-liste.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listFeedback } from '#lib/server/feedback.ts';
import type { PageServerLoad } from './$types';

/** Rückmeldungen je Schritt „ältere laden“ (Kap. 6.7) */
const SCHRITT = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
	const status = url.searchParams.get('stand') ?? 'offen';
	const kind = url.searchParams.get('art') ?? '';
	const anzahl = anzahlAus(url, SCHRITT, 10000);
	const liste = await listFeedback(requirePrincipal(locals), { status, kind }, anzahl);
	return {
		liste,
		gesamt: liste[0]?.gesamt ?? 0,
		anzahl,
		schritt: SCHRITT,
		filter: { status, kind }
	};
};
