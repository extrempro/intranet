import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import { howTo, setHowTo } from '#lib/server/kulissen.ts';
import type { Actions, PageServerLoad } from './$types';

/** Text „So geht’s“ (Kap. 8.4), gilt für alle Mandanten. */
export const load: PageServerLoad = async ({ locals }) => {
	requireThat(isSystemAdmin(requirePrincipal(locals)));
	return { text: await howTo() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		requireThat(isSystemAdmin(p));
		await setHowTo(String((await request.formData()).get('text') ?? ''), p.personId);
		return { gespeichert: true };
	}
};
