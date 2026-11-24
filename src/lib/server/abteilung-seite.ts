/** Abteilungsseite mit Reitern: Formular-Aktionen, die auf jeder Unterseite gehen. */
import { error, fail, type Action } from '@sveltejs/kit';
import { requirePrincipal } from './auth/guard.ts';
import { DepartmentError, getDepartment, markReviewed } from './departments.ts';
import { toggleFavorite, unitFavoriteKey } from './preferences.ts';

export const abteilungSeiteActions: Record<string, Action> = {
	favorit: async ({ locals, params }) => {
		const p = requirePrincipal(locals);
		const einheit = await getDepartment(p, params.slug ?? '');
		if (!einheit) error(404, 'Diese Abteilung gibt es nicht.');
		const r = await toggleFavorite(p.personId, unitFavoriteKey(einheit.id));
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	geprueft: async ({ locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const einheit = await getDepartment(p, params.slug ?? '');
		if (!einheit) error(404, 'Diese Abteilung gibt es nicht.');
		try {
			await markReviewed(p, einheit.id, getClientAddress());
		} catch (err) {
			if (err instanceof DepartmentError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { ok: 'Danke! Die Zuständigkeiten gelten als geprüft.' };
	}
};
