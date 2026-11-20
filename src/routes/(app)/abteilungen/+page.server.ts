import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listDepartments } from '#lib/server/departments.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [einheiten, favs] = await Promise.all([listDepartments(p), listFavorites(p.personId)]);
	return { einheiten, favorit: favs.some((f) => f.key === 'abteilungen') };
};

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'abteilungen');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
