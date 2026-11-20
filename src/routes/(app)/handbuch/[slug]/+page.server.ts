import { error } from '@sveltejs/kit';
import { HANDBOOK_CHAPTERS, HANDBOOK_ROLES } from '#lib/handbook.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { handbookAll, handbookArticle } from '#lib/server/handbook.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePrincipal(locals);
	const a = handbookArticle(params.slug);
	if (!a) error(404, 'Diesen Artikel gibt es nicht.');
	const gleich = handbookAll().filter((m) => m.chapter === a.meta.chapter);
	const i = gleich.findIndex((m) => m.slug === a.meta.slug);
	return {
		meta: a.meta,
		html: a.html,
		kapitel: HANDBOOK_CHAPTERS.find((c) => c.key === a.meta.chapter)!.label,
		rollen: a.meta.roles.includes('alle') ? null : a.meta.roles.map((r) => HANDBOOK_ROLES[r]),
		vorher: i > 0 ? gleich[i - 1] : null,
		nachher: i < gleich.length - 1 ? gleich[i + 1] : null
	};
};
