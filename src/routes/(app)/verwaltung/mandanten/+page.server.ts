import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listTenants } from '#lib/server/tenants.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	return { mandanten: await listTenants(p), systemAdmin: isSystemAdmin(p) };
};
