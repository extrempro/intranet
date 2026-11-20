import { error, fail, redirect } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readTenantForm } from '#lib/server/tenant-form.ts';
import { createTenant, TenantError } from '#lib/server/tenants.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!isSystemAdmin(requirePrincipal(locals))) error(403, 'Das dürfen nur System-Admins.');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const input = readTenantForm(await request.formData());
		let id: string;
		try {
			id = await createTenant(p, input, getClientAddress());
		} catch (err) {
			if (err instanceof TenantError) return fail(400, { fehler: err.message, werte: input });
			throw err;
		}
		redirect(303, `/verwaltung/mandanten/${id}`);
	}
};
