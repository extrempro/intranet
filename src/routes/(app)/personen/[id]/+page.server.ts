import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getPerson } from '#lib/server/people.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const person = await getPerson(requirePrincipal(locals), params.id);
	if (!person) error(404, 'Diese Person gibt es nicht oder du kannst sie nicht sehen.');
	return { person };
};
