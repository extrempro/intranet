import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { subscriptionActions } from '#lib/server/hub-actions.ts';
import { myHubs } from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	hubs: await myHubs(requirePrincipal(locals))
});

export const actions: Actions = { ...subscriptionActions };
