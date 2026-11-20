import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { allLocations, canteenView, myLocationIds, setMyLocations } from '#lib/server/canteen.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const [alle, meine, favs] = await Promise.all([
		allLocations(),
		myLocationIds(p.personId),
		listFavorites(p.personId)
	]);
	const wunsch = url.searchParams.get('standort');
	const gewaehltId = alle.find((l) => l.id === wunsch)?.id ?? meine[0] ?? null;
	const ansicht = gewaehltId ? await canteenView(gewaehltId) : null;
	// Angezeigter Plan: gewählter (aktuell oder kommend), sonst der aktuelle
	const planWunsch = url.searchParams.get('plan');
	const plan =
		(ansicht &&
			(ansicht.upcoming.find((m) => m.id === planWunsch) ??
				(ansicht.current?.id === planWunsch ? ansicht.current : null) ??
				ansicht.current)) ||
		null;
	return {
		alle,
		meine: alle.filter((l) => meine.includes(l.id)),
		ansicht,
		plan,
		favorit: favs.some((f) => f.key === 'speiseplan')
	};
};

export const actions: Actions = {
	standorte: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		await setMyLocations(p.personId, f.getAll('standort').map(String));
		return { gespeichert: true };
	},
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'speiseplan');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
