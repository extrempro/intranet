import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getPerson, grantRole, revokeRole, setPersonActive, UserError } from '#lib/server/users.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		return { person: await getPerson(requirePrincipal(locals), params.id) };
	} catch (err) {
		if (err instanceof UserError) error(404, err.message);
		throw err;
	}
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { gespeichert: true };
	} catch (err) {
		if (err instanceof UserError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	vergeben: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		const input = {
			role: String(f.get('rolle') ?? ''),
			scope: String(f.get('bereich') ?? ''),
			scopeId: String(f.get('ziel') ?? '')
		};
		return guarded(() => grantRole(requirePrincipal(locals), params.id, input, getClientAddress()));
	},
	entziehen: async ({ request, locals, params, getClientAddress }) => {
		const id = String((await request.formData()).get('zuordnung') ?? '');
		return guarded(() => revokeRole(requirePrincipal(locals), params.id, id, getClientAddress()));
	},
	sperren: async ({ locals, params, getClientAddress }) =>
		guarded(() => setPersonActive(requirePrincipal(locals), params.id, false, getClientAddress())),
	freigeben: async ({ locals, params, getClientAddress }) =>
		guarded(() => setPersonActive(requirePrincipal(locals), params.id, true, getClientAddress()))
};
