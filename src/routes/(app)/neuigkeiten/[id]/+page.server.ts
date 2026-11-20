import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { deleteNews, dismissUrgent, getNews, NewsError, react } from '#lib/server/news.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const beitrag = await getNews(requirePrincipal(locals), params.id);
	if (!beitrag) error(404, 'Diesen Beitrag gibt es nicht oder nicht mehr.');
	return { beitrag };
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { ok: true };
	} catch (err) {
		if (err instanceof NewsError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	reagieren: async ({ locals, params, request }) => {
		const emoji = String((await request.formData()).get('emoji') ?? '').slice(0, 16);
		return guarded(() => react(requirePrincipal(locals), params.id, emoji));
	},
	zuklappen: async ({ locals, params }) =>
		guarded(() => dismissUrgent(requirePrincipal(locals), params.id)),
	loeschen: async ({ locals, params, getClientAddress }) => {
		const r = await guarded(() =>
			deleteNews(requirePrincipal(locals), params.id, getClientAddress())
		);
		if ('ok' in r) redirect(303, '/neuigkeiten');
		return r;
	}
};
