import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscriptionActions } from '#lib/server/hub-actions.ts';
import { listHubs, mayReviewApplications, myApplications } from '#lib/server/hubs.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [hubs, favs, antraege] = await Promise.all([
		listHubs(p),
		listFavorites(p.personId),
		myApplications(p)
	]);
	return {
		hubs,
		antraegePruefen: mayReviewApplications(p),
		offeneAntraege: antraege.filter((a) => a.status === 'neu' || a.status === 'bei_verwaltung')
			.length,
		favorit: favs.some((f) => f.key === 'hubs')
	};
};

export const actions: Actions = {
	...subscriptionActions,
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'hubs');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
