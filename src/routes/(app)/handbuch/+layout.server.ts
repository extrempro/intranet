import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { handbookIndex } from '#lib/server/handbook.ts';
import type { LayoutServerLoad } from './$types';

/** Themenleiste (Entwurf): Kapitel nach Rolle gefiltert (Kap. 13); „alle“ zeigt alle. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const alle = url.searchParams.get('alle') === '1';
	return { ...handbookIndex(requirePrincipal(locals), alle), alle };
};
