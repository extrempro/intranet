import { error } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { subscriptionActions } from '#lib/server/hub-actions.ts';
import { getHub } from '#lib/server/hubs.ts';
import { einheitVideos } from '#lib/server/mediathek.ts';
import { listNews } from '#lib/server/news.ts';
import { listFavorites, toggleFavorite, unitFavoriteKey } from '#lib/server/preferences.ts';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const ERSTE = 4;
const ALLE = 50;

/** Erstes Bild je Beitrag (Anhang, sonst Bild im Text) für die Kacheln */
async function vorschaubilder(ids: string[]): Promise<Map<string, string>> {
	if (!ids.length) return new Map();
	const liste = sql.join(
		ids.map((id) => sql`${id}::uuid`),
		sql`, `
	);
	const rows = await db.execute<{ news_id: string; file_id: string }>(sql`
		select distinct on (n.id) n.id as news_id, coalesce(
			(select a.file_id from news_attachments a join files f on f.id = a.file_id
				where a.news_id = n.id and f.kind in ('jpeg', 'png', 'webp') order by a.position limit 1),
			(select t.file_id from text_images t where t.news_id = n.id limit 1)
		) as file_id
		from news n where n.id in (${liste})`);
	return new Map(rows.filter((r) => r.file_id).map((r) => [r.news_id, `/dateien/${r.file_id}`]));
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht oder nicht mehr.');
	const alle = url.searchParams.has('alle');
	// Einer mehr, um zu wissen, ob es weitere gibt
	const liste = await listNews(p, { unitIds: [hub.id], limit: (alle ? ALLE : ERSTE) + 1 });
	const beitraege = liste.slice(0, alle ? ALLE : ERSTE);
	const bilder = await vorschaubilder(beitraege.map((b) => b.id));
	return {
		hub,
		alle,
		beitraege: beitraege.map((b) => ({ ...b, bild: bilder.get(b.id) ?? null })),
		weitere: !alle && liste.length > ERSTE,
		mediathek: await einheitVideos(p, hub.id),
		favorit: (await listFavorites(p.personId)).some((f) => f.key === unitFavoriteKey(hub.id))
	};
};

export const actions: Actions = {
	...subscriptionActions,
	favorit: async ({ locals, params }) => {
		const p = requirePrincipal(locals);
		const hub = await getHub(p, params.slug);
		if (!hub) error(404, 'Diesen Hub gibt es nicht.');
		const r = await toggleFavorite(p.personId, unitFavoriteKey(hub.id));
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
