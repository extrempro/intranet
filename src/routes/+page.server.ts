import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	name: locals.person?.displayName ?? ''
});
