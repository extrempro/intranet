import { fail } from '@sveltejs/kit';
import { anzahlAus } from '#lib/lange-liste.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	archivePlans,
	archiveYears,
	currentPlans,
	kbbList,
	todayBerlin
} from '#lib/server/plans.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

/** Pläne je Schritt „ältere laden“ im Archiv (Kap. 6.7) */
const SCHRITT = 40;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const heute = todayBerlin();
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const kbbs = await kbbList(p);
	const gewaehlt = kbbs.find((k) => k.unitId === url.searchParams.get('kbb')) ?? kbbs[0] ?? null;
	const [aktuelle, jahre, favs] = await Promise.all([
		gewaehlt ? currentPlans(gewaehlt.unitId, heute, q) : [],
		gewaehlt ? archiveYears(gewaehlt.unitId, heute, q) : [],
		listFavorites(p.personId)
	]);
	const wunsch = Number.parseInt(url.searchParams.get('jahr') ?? '', 10);
	const jahr = jahre.find((j) => j.jahr === wunsch) ?? jahre[0] ?? null;
	const anzahl = anzahlAus(url, SCHRITT, jahr?.n ?? SCHRITT);
	const archiv =
		gewaehlt && jahr ? await archivePlans(gewaehlt.unitId, heute, jahr.jahr, anzahl, q) : [];
	return {
		kbbs,
		gewaehlt,
		q,
		aktuelle,
		jahre,
		jahr: jahr?.jahr ?? null,
		archiv,
		archivGesamt: jahr?.n ?? 0,
		anzahl,
		schritt: SCHRITT,
		heute,
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
