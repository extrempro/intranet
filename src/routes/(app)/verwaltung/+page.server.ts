import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const principal = requirePrincipal(locals);
	return { systemAdmin: isSystemAdmin(principal) };
};
