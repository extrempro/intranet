import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getAgreement } from '#lib/server/legal.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const v = await getAgreement(requirePrincipal(locals), params.id);
	if (!v) error(404, 'Diese Vereinbarung gibt es nicht oder nicht mehr.');
	return { v };
};
