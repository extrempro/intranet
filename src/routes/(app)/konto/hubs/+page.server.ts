import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscriptionActions } from '#lib/server/hub-actions.ts';
import {
	applyHubDefaults,
	getHubDefaults,
	HubError,
	myHubs,
	setHubDefaults,
	unsubscribeAllOptional
} from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [hubs, standard] = await Promise.all([myHubs(p), getHubDefaults(p.personId)]);
	return { hubs, standard };
};

export const actions: Actions = {
	...subscriptionActions,
	standard: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		await setHubDefaults(p.personId, {
			bell: f.get('glocke') === 'on',
			push: f.get('push') === 'on',
			email: f.get('mail') === 'on'
		});
		if (f.get('anwenden') === 'ja') {
			await applyHubDefaults(p);
			return { ok: 'Standard gespeichert und auf alle Abos angewendet.' };
		}
		return { ok: 'Standard für neue Abos gespeichert.' };
	},
	alleBeenden: async ({ locals }) => {
		try {
			const n = await unsubscribeAllOptional(requirePrincipal(locals));
			return { ok: n === 1 ? '1 Abo beendet.' : `${n} Abos beendet.` };
		} catch (err) {
			if (err instanceof HubError) return fail(400, { fehler: err.message });
			throw err;
		}
	}
};
