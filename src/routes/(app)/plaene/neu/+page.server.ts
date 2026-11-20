import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { createPlan, kbbList, PlanError } from '#lib/server/plans.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const kbb = (await kbbList(p)).find(
		(k) => k.unitId === url.searchParams.get('kbb') && k.darfPflegen
	);
	if (!kbb) error(403, 'Dafür fehlt dir das Recht (Fachpflege).');
	return { kbb };
};

export const actions: Actions = {
	default: async ({ request, locals, url, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const input = {
			title: String(f.get('titel') ?? '').slice(0, 200),
			validFrom: String(f.get('von') ?? ''),
			validUntil: String(f.get('bis') ?? '')
		};
		const datei = f.get('datei');
		let id: string;
		try {
			id = await createPlan(
				p,
				url.searchParams.get('kbb') ?? '',
				input,
				datei instanceof File ? datei : null,
				getClientAddress()
			);
		} catch (err) {
			if (err instanceof PlanError) return fail(400, { fehler: err.message, werte: input });
			throw err;
		}
		redirect(303, `/plaene/${id}`);
	}
};
