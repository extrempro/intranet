import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { openFeedbackCount } from '#lib/server/feedback.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const principal = requirePrincipal(locals);
	return {
		systemAdmin: isSystemAdmin(principal),
		offeneRueckmeldungen: await openFeedbackCount(principal)
	};
};
