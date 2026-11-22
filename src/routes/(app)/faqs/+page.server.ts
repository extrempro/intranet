import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { FaqError, listFaqs, moveFaq } from '#lib/server/faqs.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const [liste, favs] = await Promise.all([
		listFaqs(p, {
			unitId: url.searchParams.get('einheit'),
			q: url.searchParams.get('q'),
			meine: url.searchParams.get('filter') === 'meine',
			thema: url.searchParams.get('thema')
		}),
		listFavorites(p.personId)
	]);
	return { ...liste, favorit: favs.some((f) => f.key === 'faqs') };
};

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'faqs');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	verschieben: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const delta = f.get('richtung') === 'hoch' ? -1 : 1;
		try {
			await moveFaq(p, String(f.get('id') ?? ''), delta);
		} catch (err) {
			if (err instanceof FaqError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { verschoben: true };
	}
};
