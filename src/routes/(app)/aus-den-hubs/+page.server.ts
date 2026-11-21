import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscribedHubIds } from '#lib/server/hubs.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const alle = url.searchParams.get('ansicht') === 'alle';
	const angeheftet = url.searchParams.get('filter') === 'angeheftet';
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const hub = url.searchParams.get('hub') ?? '';
	const abos = await subscribedHubIds(p);
	const basis = alle ? { hubs: 'only' as const } : { unitIds: abos };
	const [alleItems, favs] = await Promise.all([
		listNews(p, { ...basis, q: q || null, limit: 50 }),
		listFavorites(p.personId)
	]);
	// Hubs für den Filter „Hub: …“ aus den sichtbaren Beiträgen
	const hubs = [...new Map(alleItems.map((i) => [i.sender.id, i.sender])).values()].sort((a, b) =>
		a.name.localeCompare(b.name, 'de')
	);
	const items = alleItems.filter((i) => (!angeheftet || i.pinned) && (!hub || i.sender.id === hub));
	return {
		items,
		alle,
		angeheftet,
		q,
		hub: hubs.some((h) => h.id === hub) ? hub : '',
		hubs,
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
