import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { handbookArticle } from '#lib/server/handbook.ts';
import type { PageServerLoad } from './$types';

/** Startseite des Handbuchs: auf breiten Bildschirmen gleich „Erste Schritte“. */
export const load: PageServerLoad = async ({ locals }) => {
	requirePrincipal(locals);
	const a = handbookArticle('erste-schritte');
	return { start: a ? { meta: a.meta, html: a.html } : null };
};
