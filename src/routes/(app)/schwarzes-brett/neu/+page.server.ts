import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { allTenantsList, categories, createAd } from '#lib/server/board.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [kategorien, mandanten] = await Promise.all([categories(), allTenantsList()]);
	return {
		kategorien,
		mandanten: mandanten.map((m) => ({ ...m, eigener: m.id === p.tenantId })),
		ich: locals.person!.displayName
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const input = {
			categoryId: String(f.get('kategorie') ?? ''),
			title: String(f.get('titel') ?? '').slice(0, 200),
			body: String(f.get('text') ?? '').slice(0, 2000),
			viaApps: f.get('apps') === 'on',
			ownContact: String(f.get('kontakt') ?? '').slice(0, 200),
			tenantIds: f.getAll('mandanten').map(String).slice(0, 50),
			photoIds: f.getAll('fotos').map(String).slice(0, 10)
		};
		const r = await createAd(p, input);
		if (!r.ok) return fail(400, { werte: input, fehler: r.errors });
		redirect(303, '/schwarzes-brett?ansicht=meine&neu=1');
	}
};
