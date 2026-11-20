import { error, fail } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readTenantForm } from '#lib/server/tenant-form.ts';
import {
	addAdmin,
	addDomain,
	getTenant,
	removeAdmin,
	removeDomain,
	TenantError,
	updateTenant
} from '#lib/server/tenants.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	try {
		return {
			mandant: await getTenant(p, params.id),
			systemAdmin: isSystemAdmin(p),
			ichId: p.personId
		};
	} catch (err) {
		if (err instanceof TenantError) error(404, err.message);
		throw err;
	}
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { gespeichert: true };
	} catch (err) {
		if (err instanceof TenantError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	speichern: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const input = readTenantForm(await request.formData());
		return guarded(() => updateTenant(p, params.id, input, getClientAddress()));
	},
	domainHinzu: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const domain = String((await request.formData()).get('domain') ?? '').slice(0, 260);
		return guarded(() => addDomain(p, params.id, domain, getClientAddress()));
	},
	domainEntfernen: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const domain = String((await request.formData()).get('domain') ?? '').slice(0, 260);
		return guarded(() => removeDomain(p, params.id, domain, getClientAddress()));
	},
	adminHinzu: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const email = String((await request.formData()).get('email') ?? '').slice(0, 320);
		return guarded(() => addAdmin(p, params.id, email, getClientAddress()));
	},
	adminEntfernen: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const person = String((await request.formData()).get('person') ?? '').slice(0, 40);
		return guarded(() => removeAdmin(p, params.id, person, getClientAddress()));
	}
};
