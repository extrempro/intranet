import { error, fail } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { allRetention, saveRetention } from '#lib/server/retention.ts';
import type { Actions, PageServerLoad } from './$types';

/** Löschfristen (Kap. 15): System-Admins ändern, Mandanten-Admins lesen. */
export const load: PageServerLoad = async ({ locals }) => ({
	fristen: await allRetention(),
	darfAendern: isSystemAdmin(requirePrincipal(locals))
});

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		if (!isSystemAdmin(p)) error(403, 'Nur System-Admins ändern die Löschfristen.');
		const f = await request.formData();
		const form = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v).slice(0, 20)]));
		const fehler = await saveRetention(form, p.personId, getClientAddress());
		if (Object.keys(fehler).length) return fail(400, { fehler });
		return { gespeichert: true };
	}
};
