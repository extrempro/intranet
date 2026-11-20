import { isoWeek } from '#lib/canteen.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscribedHubIds } from '#lib/server/hubs.ts';
import { listNews } from '#lib/server/news.ts';
import { latestPlans } from '#lib/server/plans.ts';
import type { PageServerLoad } from './$types';

/** Mo–Fr der laufenden Woche als „KW 47 · 16.–20. November“ (Berlin). */
function wochentext(now = new Date()): string {
	const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
	const d = new Date(`${heute}T12:00:00Z`);
	const montag = new Date(d);
	montag.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	const freitag = new Date(montag);
	freitag.setUTCDate(montag.getUTCDate() + 4);
	const monat = (x: Date) =>
		new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(x);
	const von = montag.getUTCDate();
	const bis = freitag.getUTCDate();
	const spanne =
		monat(montag) === monat(freitag)
			? `${von}.–${bis}. ${monat(freitag)}`
			: `${von}. ${monat(montag)} – ${bis}. ${monat(freitag)}`;
	return `KW ${isoWeek(montag.toISOString().slice(0, 10))} · ${spanne}`;
}

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [beitraege, plaene, hubs] = await Promise.all([
		listNews(p, { limit: 50 }),
		latestPlans(p, 1),
		subscribedHubIds(p)
	]);
	const angeheftet = beitraege.filter((b) => b.pinned && !b.planned);
	return {
		angeheftet: angeheftet.map((b) => ({ id: b.id, title: b.title })),
		texte: {
			plaene: plaene[0] ? `Aktuell: ${plaene[0].title}` : null,
			'aus-den-hubs':
				hubs.length === 0
					? null
					: hubs.length === 1
						? '1 Hub abonniert'
						: `${hubs.length} Hubs abonniert`,
			speiseplan: wochentext()
		} as Record<string, string | null>
	};
};
