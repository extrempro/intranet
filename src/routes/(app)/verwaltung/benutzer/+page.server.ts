import { anzahlAus } from '#lib/lange-liste.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listPersons } from '#lib/server/users.ts';
import type { PageServerLoad } from './$types';

/** Personen je Schritt „weitere anzeigen“ (Kap. 6.7) */
const SCHRITT = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
	const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
	const anzahl = anzahlAus(url, SCHRITT, 10000);
	const personen = await listPersons(requirePrincipal(locals), q, anzahl);
	return { q, personen, gesamt: personen[0]?.gesamt ?? 0, anzahl, schritt: SCHRITT };
};
