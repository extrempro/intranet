import { bestaetigtBis } from '#lib/server/auth/bestaetigung.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import type { PageServerLoad } from './$types';

/** Ende der Microsoft-Bestätigung im eigenen Fenster: Dialog informieren, Fenster schließen */
export const load: PageServerLoad = ({ locals }) => {
	requirePrincipal(locals);
	return { bis: bestaetigtBis(locals)?.toISOString() ?? null };
};
