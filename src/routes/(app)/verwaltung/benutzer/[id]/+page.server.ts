import { error, fail } from '@sveltejs/kit';
import { bestaetigungFehlt } from '#lib/server/auth/bestaetigung.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	getPerson,
	grantRole,
	revokeRole,
	setPersonActive,
	setPersonHidden,
	UserError
} from '#lib/server/users.ts';
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
	// Rollen und Sperren nur nach erneuter Anmeldung (ASVS V3.7.1)
	vergeben: async ({ request, locals, params, getClientAddress }) => {
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const f = await request.formData();
		const input = {
			role: String(f.get('rolle') ?? ''),
			scope: String(f.get('bereich') ?? ''),
			scopeId: String(f.get('ziel') ?? '')
		};
		return guarded(() => grantRole(requirePrincipal(locals), params.id, input, getClientAddress()));
	},
	entziehen: async ({ request, locals, params, getClientAddress }) => {
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const id = String((await request.formData()).get('zuordnung') ?? '');
		return guarded(() => revokeRole(requirePrincipal(locals), params.id, id, getClientAddress()));
	},
	sperren: async ({ locals, params, getClientAddress }) =>
		bestaetigungFehlt(locals) ??
		guarded(() => setPersonActive(requirePrincipal(locals), params.id, false, getClientAddress())),
	ausblenden: async ({ request, locals, params, getClientAddress }) => {
		const an = (await request.formData()).get('wert') === 'an';
		return guarded(() =>
			setPersonHidden(requirePrincipal(locals), params.id, an, getClientAddress())
		);
	},
	freigeben: async ({ locals, params, getClientAddress }) =>
		bestaetigungFehlt(locals) ??
		guarded(() => setPersonActive(requirePrincipal(locals), params.id, true, getClientAddress()))
};
