import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { kbbList, listPlans, todayBerlin } from '#lib/server/plans.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const kbbs = await kbbList(p);
	const gewaehlt = kbbs.find((k) => k.unitId === url.searchParams.get('kbb')) ?? kbbs[0] ?? null;
	const [plaene, favs] = await Promise.all([
		gewaehlt ? listPlans(gewaehlt.unitId) : [],
		listFavorites(p.personId)
	]);
	return {
		kbbs,
		gewaehlt,
		plaene,
		heute: todayBerlin(),
		favorit: favs.some((f) => f.key === 'plaene')
	};
};

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'plaene');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
