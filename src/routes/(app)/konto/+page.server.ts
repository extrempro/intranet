import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { resetHelpSeen } from '#lib/server/preferences.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	einfuehrungen: async ({ locals }) => {
		await resetHelpSeen(requirePrincipal(locals).personId);
		return { zurueckgesetzt: true };
	}
};
