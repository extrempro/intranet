import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { myFeedback } from '#lib/server/feedback.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	meldungen: await myFeedback(requirePrincipal(locals))
});
