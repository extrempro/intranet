import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { canMaintainOrgChart, getOrgChart, PlanError, replaceOrgChart } from '#lib/server/plans.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [organigramm, favs] = await Promise.all([getOrgChart(), listFavorites(p.personId)]);
	return {
		organigramm,
		darfPflegen: canMaintainOrgChart(p),
		favorit: favs.some((f) => f.key === 'organigramm')
	};
};

export const actions: Actions = {
	hochladen: async ({ request, locals, getClientAddress }) => {
		const f = await request.formData();
		const datei = f.get('datei');
		try {
			await replaceOrgChart(
				requirePrincipal(locals),
				String(f.get('stand') ?? ''),
				datei instanceof File ? datei : null,
				getClientAddress()
			);
			return { gespeichert: true };
		} catch (err) {
			if (err instanceof PlanError) return fail(400, { fehler: err.message });
			throw err;
		}
	},
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'organigramm');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
