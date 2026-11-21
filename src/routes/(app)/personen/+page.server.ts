import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listPeople } from '#lib/server/people.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => ({
	...(await listPeople(requirePrincipal(locals), {
		q: url.searchParams.get('q'),
		unitId: url.searchParams.get('einheit')
	})),
	alle: url.searchParams.get('alle') === '1'
});
