import { isSearchKind, QUERY_MAX, SEARCH_KINDS } from '#lib/search.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { search } from '#lib/server/search.ts';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { responsibilities, units } from '#lib/server/db/schema.ts';
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
	// Ohne Suchbegriff: Themen aus „Wer hilft bei was?“ als Vorschläge (eigener Mandant und zentral)
	const vorschlaege = q.trim()
		? []
		: [
				...new Set(
					(
						await db
							.select({ topic: responsibilities.topic })
							.from(responsibilities)
							.innerJoin(units, eq(units.id, responsibilities.unitId))
							.where(
								and(
									isNull(units.archivedAt),
									or(eq(units.isCentral, true), eq(units.tenantId, p.tenantId))
								)
							)
							.orderBy(asc(responsibilities.position), asc(responsibilities.topic))
							.limit(30)
					).map((r) => r.topic.trim())
				)
			].slice(0, 8);
	return {
		q,
		vorschlaege,
		art: kind,
		arten: SEARCH_KINDS.map((k) => ({ ...k })),
		treffer
	};
};
