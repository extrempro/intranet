import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { deleteNews, dismissUrgent, getNews, NewsError, react } from '#lib/server/news.ts';
import {
	antwortenSpeichern,
	UmfrageFehler,
	umfrageBeenden,
	umfrageFuerBeitrag
} from '#lib/server/umfragen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const beitrag = await getNews(p, params.id);
	if (!beitrag) error(404, 'Diesen Beitrag gibt es nicht oder nicht mehr.');
	return { beitrag, umfrage: await umfrageFuerBeitrag(p, params.id) };
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { ok: true };
	} catch (err) {
		if (err instanceof NewsError || err instanceof UmfrageFehler)
			return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	reagieren: async ({ locals, params, request }) => {
		const emoji = String((await request.formData()).get('emoji') ?? '').slice(0, 16);
		return guarded(() => react(requirePrincipal(locals), params.id, emoji));
	},
	umfrage: async ({ locals, params, request }) => {
		const p = requirePrincipal(locals);
		try {
			const r = await antwortenSpeichern(p, params.id, await request.formData());
			if (r.fehlend.length)
				return fail(400, {
					fehler: 'Bitte beantworte alle Pflichtfragen.',
					umfrageFehlend: r.fehlend
				});
			return { umfrageGesendet: true };
		} catch (err) {
			if (err instanceof UmfrageFehler) return fail(400, { fehler: err.message });
			throw err;
		}
	},
	umfrageBeenden: async ({ locals, params, getClientAddress }) =>
		guarded(() => umfrageBeenden(requirePrincipal(locals), params.id, getClientAddress())),
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
