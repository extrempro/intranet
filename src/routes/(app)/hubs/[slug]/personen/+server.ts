import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { personenFuerHub } from '#lib/server/hub-pflege.ts';
import { getHub, HubError } from '#lib/server/hubs.ts';

/** Personensuche beim Bearbeiten eines Hubs (nur für die Pflege). */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug ?? '');
	if (!hub?.canManage) error(404, 'Nicht gefunden.');
	try {
		return json(await personenFuerHub(p, hub.id, url.searchParams.get('q') ?? ''));
	} catch (err) {
		if (err instanceof HubError) error(403, err.message);
		throw err;
	}
};
