import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { hubBeitraege, hubSeiteActions } from '#lib/server/hub-seite.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { hub } = await parent();
	return hubBeitraege(requirePrincipal(locals), hub.id, 50);
};

export const actions = hubSeiteActions;
