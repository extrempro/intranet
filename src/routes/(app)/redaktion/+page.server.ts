import { canSeeAdministration } from '#lib/server/auth/access.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import { editorialWorklist, mayOpenEditorial } from '#lib/server/redaktion.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	requireThat(mayOpenEditorial(p));
	return { liste: await editorialWorklist(p), verwaltung: canSeeAdministration(p) };
};
