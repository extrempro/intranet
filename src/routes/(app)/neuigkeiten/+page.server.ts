import { fail } from '@sveltejs/kit';
import { isEditorial } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listNews, senders, writableUnits, type NewsFilter } from '#lib/server/news.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import { getContentRules } from '#lib/server/rules.ts';
import type { Actions, PageServerLoad } from './$types';

const FILTERS: NewsFilter[] = ['alle', 'meine', 'geplant'];

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const f = url.searchParams.get('filter') as NewsFilter;
	const filter = FILTERS.includes(f) ? f : 'alle';
	const von = url.searchParams.get('von');
	const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
	const [items, absender, schreibbar, favs, regeln] = await Promise.all([
		listNews(p, { filter, from: von && /^[0-9a-f-]{36}$/i.test(von) ? von : null, q }),
		senders(p),
		writableUnits(p),
		listFavorites(p.personId),
		getContentRules()
	]);
	return {
		items,
		absender,
		filter,
		von,
		q,
		darfSchreiben: schreibbar.length > 0,
		darfGeplant: schreibbar.length > 0 || isEditorial(p),
		favorit: favs.some((x) => x.key === 'neuigkeiten'),
		angeheftetSichtbar: regeln.pinShown
	};
};

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'neuigkeiten');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
