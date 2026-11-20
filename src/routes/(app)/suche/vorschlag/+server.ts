import { json } from '@sveltejs/kit';
import { QUERY_MAX, SEARCH_KINDS } from '#lib/search.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { search } from '#lib/server/search.ts';
import type { RequestHandler } from './$types';

/** Vorschläge beim Tippen (Kopfzeile): je Art bis zu 3, insgesamt höchstens 10. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const q = (url.searchParams.get('q') ?? '').slice(0, QUERY_MAX);
	if (q.trim().length < 2) return json({ treffer: [] });
	const r = await search(p, q, { limit: 3 });
	const treffer = SEARCH_KINDS.flatMap((k) =>
		r[k.key].map(({ kind, title, href, meta, foto }) => ({
			kind,
			label: k.label,
			title,
			href,
			meta,
			foto
		}))
	).slice(0, 10);
	return json({ treffer }, { headers: { 'Cache-Control': 'private, no-store' } });
};
