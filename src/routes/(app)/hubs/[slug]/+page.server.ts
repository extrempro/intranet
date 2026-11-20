import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscriptionActions } from '#lib/server/hub-actions.ts';
import { getHub } from '#lib/server/hubs.ts';
import { listNews } from '#lib/server/news.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht oder nicht mehr.');
	const beitraege = await listNews(p, { unitIds: [hub.id], limit: 10 });
	return { hub, beitraege };
};

export const actions: Actions = { ...subscriptionActions };
