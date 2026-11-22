import { fail } from '@sveltejs/kit';
import { isEditorial } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import { ansichtAction } from '#lib/server/lange-liste.ts';
import {
	listNews,
	NEWS_MAX,
	newsMonths,
	senders,
	writableUnits,
	type ListOptions,
	type NewsFilter
} from '#lib/server/news.ts';
import { getListView, listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import { getContentRules } from '#lib/server/rules.ts';
import type { Actions, PageServerLoad } from './$types';

const FILTERS: NewsFilter[] = ['alle', 'meine', 'geplant'];
/** Beiträge je Schritt „ältere laden“ (Kap. 6.7) */
const SCHRITT = 20;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const f = url.searchParams.get('filter') as NewsFilter;
	const filter = FILTERS.includes(f) ? f : 'alle';
	const von = url.searchParams.get('von');
	const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
	const anzahl = anzahlAus(url, SCHRITT, NEWS_MAX);
	const opts: ListOptions = { filter, from: von && /^[0-9a-f-]{36}$/i.test(von) ? von : null, q };
	const [items, angeheftet, zahlen, absender, schreibbar, favs, regeln, ansicht] =
		await Promise.all([
			listNews(p, { ...opts, angeheftet: 'ohne', limit: anzahl }),
			listNews(p, { ...opts, angeheftet: 'nur', limit: 50 }),
			newsMonths(p, { ...opts, angeheftet: 'ohne' }),
			senders(p),
			writableUnits(p),
			listFavorites(p.personId),
			getContentRules(),
			getListView(p.personId)
		]);
	return {
		items,
		angeheftet,
		gesamt: zahlen.gesamt,
		monate: zahlen.monate,
		anzahl,
		schritt: SCHRITT,
		ansicht,
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
	ansicht: ansichtAction,
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
