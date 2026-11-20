import { error, fail } from '@sveltejs/kit';
import { validateRules } from '#lib/rules-config.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getContentRules, saveContentRules } from '#lib/server/rules.ts';
import type { Actions, PageServerLoad } from './$types';

/** Regeln für Inhalte (Kap. 14): System-Admins ändern, Mandanten-Admins lesen. */
export const load: PageServerLoad = async ({ locals }) => ({
	regeln: await getContentRules(),
	darfAendern: isSystemAdmin(requirePrincipal(locals))
});

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		if (!isSystemAdmin(p)) error(403, 'Nur System-Admins ändern die Regeln.');
		const f = await request.formData();
		const form = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v).slice(0, 200)]));
		const { value, errors } = validateRules(form);
		if (!value) return fail(400, { fehler: errors, eingabe: form });
		await saveContentRules(value, p.personId, getClientAddress());
		return { gespeichert: true };
	}
};
