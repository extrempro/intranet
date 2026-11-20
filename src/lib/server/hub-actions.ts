/** Gemeinsame Formular-Aktionen für Hub-Abos (Liste, Hub-Seite, Meine Hubs). */
import { fail, type Action } from '@sveltejs/kit';
import { requirePrincipal } from './auth/guard.ts';
import { HubError, setChannels, subscribe, unsubscribe } from './hubs.ts';

async function guarded(fn: () => Promise<void>, ok: Record<string, unknown>) {
	try {
		await fn();
		return ok;
	} catch (err) {
		if (err instanceof HubError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const subscriptionActions: Record<string, Action> = {
	abonnieren: async ({ request, locals }) => {
		const f = await request.formData();
		return guarded(() => subscribe(requirePrincipal(locals), String(f.get('hub') ?? '')), {
			ok: 'Abonniert. Neue Beiträge erscheinen unter „Aus den Hubs“.'
		});
	},
	abbestellen: async ({ request, locals }) => {
		const f = await request.formData();
		return guarded(() => unsubscribe(requirePrincipal(locals), String(f.get('hub') ?? '')), {
			ok: 'Abo beendet.'
		});
	},
	kanaele: async ({ request, locals }) => {
		const f = await request.formData();
		return guarded(
			() =>
				setChannels(
					requirePrincipal(locals),
					String(f.get('hub') ?? ''),
					f.get('glocke') === 'on',
					f.get('push') === 'on',
					f.get('mail') === 'on'
				),
			{ ok: 'Gespeichert.' }
		);
	}
};
