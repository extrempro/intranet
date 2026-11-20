import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { handbookIndex } from '#lib/server/handbook.ts';
import type { PageServerLoad } from './$types';

/** Handbuch nach Rolle gefiltert (Kap. 13); „alle“ zeigt alle Kapitel. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const alle = url.searchParams.get('alle') === '1';
	return { ...handbookIndex(requirePrincipal(locals), alle), alle };
};
