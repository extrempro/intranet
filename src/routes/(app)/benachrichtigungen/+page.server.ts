import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listNotifications, markAllRead } from '#lib/server/notify.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	liste: await listNotifications(requirePrincipal(locals).personId)
});

export const actions: Actions = {
	alleGelesen: async ({ locals }) => {
		await markAllRead(requirePrincipal(locals).personId);
		return { erledigt: true };
	}
};
