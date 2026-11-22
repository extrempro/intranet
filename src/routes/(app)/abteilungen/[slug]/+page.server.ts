import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { DepartmentError, getDepartment, markReviewed } from '#lib/server/departments.ts';
import { einheitVideos } from '#lib/server/mediathek.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, toggleFavorite, unitFavoriteKey } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const einheit = await getDepartment(p, params.slug);
	if (!einheit) error(404, 'Diese Abteilung gibt es nicht oder nicht mehr.');
	const [beitraege, favs, mediathek] = await Promise.all([
		listNews(p, { unitIds: [einheit.id], limit: 5 }),
		listFavorites(p.personId),
		einheitVideos(p, einheit.id)
	]);
	return {
		einheit,
		beitraege: beitraege.filter((b) => !b.planned),
		mediathek,
		favorit: favs.some((f) => f.key === unitFavoriteKey(einheit.id))
	};
};

export const actions: Actions = {
	favorit: async ({ locals, params }) => {
		const p = requirePrincipal(locals);
		const einheit = await getDepartment(p, params.slug);
		if (!einheit) error(404, 'Diese Abteilung gibt es nicht.');
		const r = await toggleFavorite(p.personId, unitFavoriteKey(einheit.id));
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	geprueft: async ({ locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const einheit = await getDepartment(p, params.slug);
		if (!einheit) error(404, 'Diese Abteilung gibt es nicht.');
		try {
			await markReviewed(p, einheit.id, getClientAddress());
		} catch (err) {
			if (err instanceof DepartmentError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { ok: 'Danke! Die Zuständigkeiten gelten als geprüft.' };
	}
};
