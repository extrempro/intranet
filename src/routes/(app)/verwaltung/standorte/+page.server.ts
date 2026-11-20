import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { CanteenError, createLocation, listLocationsForAdmin } from '#lib/server/canteen.ts';
import { administrableTenants } from '#lib/server/units.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [standorte, mandanten] = await Promise.all([
		listLocationsForAdmin(p),
		administrableTenants(p)
	]);
	return { standorte, mandanten };
};

export const actions: Actions = {
	anlegen: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const input = {
			tenantId: String(f.get('mandant') ?? ''),
			name: String(f.get('name') ?? ''),
			address: String(f.get('adresse') ?? '')
		};
		let id: string;
		try {
			id = await createLocation(p, input, getClientAddress());
		} catch (err) {
			if (err instanceof CanteenError) return fail(400, { ...input, fehler: err.message });
			throw err;
		}
		redirect(303, `/verwaltung/standorte/${id}`);
	}
};
