import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getDepartment } from '#lib/server/departments.ts';
import { einheitVideos } from '#lib/server/mediathek.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, unitFavoriteKey } from '#lib/server/preferences.ts';
import type { LayoutServerLoad } from './$types';

/** Kopf und Reiter der Abteilungsseite (Überblick und Unterseiten), wie bei Hubs */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const einheit = await getDepartment(p, params.slug);
	if (!einheit) error(404, 'Diese Abteilung gibt es nicht oder nicht mehr.');
	const [neues, mediathek, favoriten] = await Promise.all([
		listNews(p, { unitIds: [einheit.id], limit: 1, intern: 'ohne' }),
		einheitVideos(p, einheit.id),
		listFavorites(p.personId)
	]);
	return {
		einheit,
		hatNeues: neues.some((b) => !b.planned),
		mediathek,
		favorit: favoriten.some((f) => f.key === unitFavoriteKey(einheit.id))
	};
};
