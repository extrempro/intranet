import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listPersons } from '#lib/server/users.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
	return { q, personen: await listPersons(requirePrincipal(locals), q) };
};
