import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { releaseNotes } from '#lib/server/changelog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePrincipal(locals);
	return { eintraege: releaseNotes() };
};
