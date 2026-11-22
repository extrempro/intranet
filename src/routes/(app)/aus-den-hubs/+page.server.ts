import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscribedHubIds } from '#lib/server/hubs.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import { ansichtAction } from '#lib/server/lange-liste.ts';
import { listNews, NEWS_MAX, newsMonths, senders, type ListOptions } from '#lib/server/news.ts';
import { getListView, listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

/** Beiträge je Schritt „ältere laden“ (Kap. 6.7) */
const SCHRITT = 20;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const alle = url.searchParams.get('ansicht') === 'alle';
	const angeheftet = url.searchParams.get('filter') === 'angeheftet';
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const hub = url.searchParams.get('hub') ?? '';
	const abos = await subscribedHubIds(p);
	const basis: ListOptions = alle ? { hubs: 'only' } : { unitIds: abos };
	const hubs = await senders(p, basis);
	const hubGueltig = hubs.some((h) => h.id === hub) ? hub : '';
	const opts: ListOptions = {
		...basis,
		q: q || null,
		from: hubGueltig || null,
		angeheftet: angeheftet ? 'nur' : undefined
	};
	const anzahl = anzahlAus(url, SCHRITT, NEWS_MAX);
	const [items, zahlen, favs, ansicht] = await Promise.all([
		listNews(p, { ...opts, nachDatum: true, limit: anzahl }),
		newsMonths(p, opts),
		listFavorites(p.personId),
		getListView(p.personId)
	]);
	return {
		items,
		alle,
		angeheftet,
		q,
		hub: hubGueltig,
		gesamt: zahlen.gesamt,
		monate: zahlen.monate,
		anzahl,
		schritt: SCHRITT,
		ansicht,
		hubs,
		keineAbos: abos.length === 0,
		favorit: favs.some((f) => f.key === 'aus-den-hubs')
	};
};

export const actions: Actions = {
	ansicht: ansichtAction,
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'aus-den-hubs');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
