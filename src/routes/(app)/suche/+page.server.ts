import { isSearchKind, QUERY_MAX, SEARCH_KINDS } from '#lib/search.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { search } from '#lib/server/search.ts';
import type { PageServerLoad } from './$types';

/** Übersicht: je Art bis zu 5 Treffer (6 geladen, um „mehr“ zu erkennen); mit Art bis zu 50. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const q = (url.searchParams.get('q') ?? '').slice(0, QUERY_MAX);
	const art = url.searchParams.get('art');
	const kind = isSearchKind(art) ? art : null;
	const treffer = q.trim()
		? await search(p, q, { kinds: kind ? [kind] : undefined, limit: kind ? 50 : 6 })
		: null;
	return {
		q,
		art: kind,
		arten: SEARCH_KINDS.map((k) => ({ ...k })),
		treffer
	};
};
