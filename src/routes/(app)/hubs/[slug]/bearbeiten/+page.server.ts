import { error, fail, redirect } from '@sveltejs/kit';
import { cleanLayout } from '#lib/hubs.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { archiveHub, getHub, HubError, setResting, updateHubPage } from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const hub = await getHub(requirePrincipal(locals), params.slug);
	if (!hub || !(hub.canManage || hub.canAdminister))
		error(404, 'Diesen Hub gibt es nicht oder du darfst ihn nicht bearbeiten.');
	return { hub };
};

async function hubId(locals: App.Locals, slug: string) {
	const hub = await getHub(requirePrincipal(locals), slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht.');
	return hub.id;
}

function guard(fn: () => Promise<unknown>, ok: Record<string, unknown>) {
	return fn().then(
		() => ok,
		(err) => {
			if (err instanceof HubError) return fail(400, { fehler: err.message });
			throw err;
		}
	);
}

export const actions: Actions = {
	speichern: async ({ request, locals, params }) => {
		const f = await request.formData();
		let layout;
		try {
			layout = cleanLayout(JSON.parse(String(f.get('aufbau') ?? '{}')));
		} catch {
			return fail(400, { fehler: 'Ungültiger Seitenaufbau.' });
		}
		const id = await hubId(locals, params.slug);
		return guard(
			() =>
				updateHubPage(requirePrincipal(locals), id, {
					notice: String(f.get('hinweis') ?? ''),
					about: String(f.get('ueber') ?? ''),
					layout
				}),
			{ gespeichert: true }
		);
	},
	ruhen: async ({ request, locals, params, getClientAddress }) => {
		const an = (await request.formData()).get('ruhen') === 'ja';
		const id = await hubId(locals, params.slug);
		return guard(() => setResting(requirePrincipal(locals), id, an, getClientAddress()), {
			ruhen: an
		});
	},
	archivieren: async ({ locals, params, getClientAddress }) => {
		const id = await hubId(locals, params.slug);
		const r = await guard(() => archiveHub(requirePrincipal(locals), id, getClientAddress()), {});
		if (r && 'status' in r) return r;
		redirect(303, '/hubs');
	}
};
