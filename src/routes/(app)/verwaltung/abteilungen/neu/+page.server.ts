import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readUnitForm } from '#lib/server/unit-form.ts';
import { administrableTenants, createUnit, UnitError } from '#lib/server/units.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	mandanten: await administrableTenants(requirePrincipal(locals))
});

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		const input = readUnitForm(await request.formData());
		let id: string;
		try {
			id = await createUnit(principal, input, getClientAddress());
		} catch (err) {
			if (err instanceof UnitError) return fail(400, { fehler: err.message, werte: input });
			throw err;
		}
		redirect(303, `/verwaltung/abteilungen/${id}`);
	}
};
