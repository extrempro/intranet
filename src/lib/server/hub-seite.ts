/** Hub-Seite mit Reitern: gemeinsame Formular-Aktionen und Vorschaubilder der Beiträge. */
import { error, fail, type Action } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { requirePrincipal } from './auth/guard.ts';
import { db } from './db/index.ts';
import { subscriptionActions } from './hub-actions.ts';
import { getHub } from './hubs.ts';
import { listNews, newsMonths } from './news.ts';
import { toggleFavorite, unitFavoriteKey } from './preferences.ts';

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

/** Beiträge eines Hubs mit Vorschaubild; `weitere` sagt, ob es mehr als `anzahl` gibt. */
export async function hubBeitraege(
	p: Parameters<typeof listNews>[0],
	hubId: string,
	anzahl: number
) {
	const [beitraege, zahlen] = await Promise.all([
		listNews(p, { unitIds: [hubId], nachDatum: true, limit: anzahl }),
		newsMonths(p, { unitIds: [hubId] })
	]);
	const bilder = await vorschaubilder(beitraege.map((b) => b.id));
	return {
		beitraege: beitraege.map((b) => ({ ...b, bild: bilder.get(b.id) ?? null })),
		gesamt: zahlen.gesamt,
		anzahl
	};
}

/** Aktionen, die auf jeder Unterseite eines Hubs gehen (Abo, Kanäle, Favorit). */
export const hubSeiteActions: Record<string, Action> = {
	...subscriptionActions,
	favorit: async ({ locals, params }) => {
		const p = requirePrincipal(locals);
		const hub = await getHub(p, params.slug ?? '');
		if (!hub) error(404, 'Diesen Hub gibt es nicht.');
		const r = await toggleFavorite(p.personId, unitFavoriteKey(hub.id));
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
