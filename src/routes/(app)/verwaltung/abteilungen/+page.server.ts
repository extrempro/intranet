import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listUnits } from '#lib/server/units.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	einheiten: await listUnits(requirePrincipal(locals))
});
