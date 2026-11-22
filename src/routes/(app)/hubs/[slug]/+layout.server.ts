import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getHub } from '#lib/server/hubs.ts';
import { einheitVideos } from '#lib/server/mediathek.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, unitFavoriteKey } from '#lib/server/preferences.ts';
import type { LayoutServerLoad } from './$types';

/** Kopf und Reiter der Hub-Seite (Überblick und Unterseiten) */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht oder nicht mehr.');
	const [neues, mediathek, favoriten] = await Promise.all([
		listNews(p, { unitIds: [hub.id], limit: 1 }),
		einheitVideos(p, hub.id),
		listFavorites(p.personId)
	]);
	return {
		hub,
		hatNeues: neues.length > 0,
		mediathek,
		favorit: favoriten.some((f) => f.key === unitFavoriteKey(hub.id))
	};
};
