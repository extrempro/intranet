import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { applyForHub } from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePrincipal(locals);
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const f = await request.formData();
		const input = {
			name: String(f.get('name') ?? '').slice(0, 200),
			description: String(f.get('beschreibung') ?? '').slice(0, 3000),
			reason: String(f.get('begruendung') ?? '').slice(0, 3000),
			team: String(f.get('team') ?? '').slice(0, 2000),
			central: f.get('zustaendigkeit') === 'zentral'
		};
		const r = await applyForHub(requirePrincipal(locals), input);
		if (!r.ok) return fail(400, { werte: input, fehler: r.errors });
		redirect(303, '/hubs/antraege?gesendet=1');
	}
};
