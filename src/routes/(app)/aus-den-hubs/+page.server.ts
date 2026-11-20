import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscribedHubIds } from '#lib/server/hubs.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const alle = url.searchParams.get('ansicht') === 'alle';
	const abos = await subscribedHubIds(p);
	const [items, favs] = await Promise.all([
		listNews(p, alle ? { hubs: 'only', limit: 50 } : { unitIds: abos, limit: 50 }),
		listFavorites(p.personId)
	]);
	return {
		items,
		alle,
		keineAbos: abos.length === 0,
		favorit: favs.some((f) => f.key === 'aus-den-hubs')
	};
};

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'aus-den-hubs');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
