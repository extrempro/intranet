import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { deletePlan, getPlan, PlanError, replacePlan, todayBerlin } from '#lib/server/plans.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const plan = await getPlan(requirePrincipal(locals), params.id);
	if (!plan) error(404, 'Diesen Plan gibt es nicht oder nicht mehr.');
	return { plan, heute: todayBerlin() };
};

export const actions: Actions = {
	ersetzen: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		const input = {
			title: String(f.get('titel') ?? '').slice(0, 200),
			validFrom: String(f.get('von') ?? ''),
			validUntil: String(f.get('bis') ?? '')
		};
		const datei = f.get('datei');
		try {
			await replacePlan(
				requirePrincipal(locals),
				params.id,
				input,
				datei instanceof File ? datei : null,
				getClientAddress()
			);
			return { gespeichert: true };
		} catch (err) {
			if (err instanceof PlanError) return fail(400, { fehler: err.message });
			throw err;
		}
	},
	loeschen: async ({ locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const plan = await getPlan(p, params.id);
		try {
			await deletePlan(p, params.id, getClientAddress());
		} catch (err) {
			if (err instanceof PlanError) return fail(400, { fehler: err.message });
			throw err;
		}
		redirect(303, `/plaene?kbb=${plan?.unitId ?? ''}`);
	}
};
