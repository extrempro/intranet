import { error } from '@sveltejs/kit';
import { canSeeAdministration, isSystemAdmin } from '#lib/server/auth/access.ts';
import { openFeedbackCount } from '#lib/server/feedback.ts';
import type { LayoutServerLoad } from './$types';

/**
 * Verwaltung nur für Mandanten- und System-Admins (Kap. 14).
 * Jede Aktion prüft ihr Recht zusätzlich selbst (Layouts schützen keine Actions).
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.principal || !canSeeAdministration(locals.principal)) {
		error(403, 'Dafür fehlt dir das Recht.');
	}
	// Zähler der offenen Rückmeldungen bei jedem Wechsel neu
	void url.pathname;
	return {
		systemAdmin: isSystemAdmin(locals.principal),
		offeneRueckmeldungen: await openFeedbackCount(locals.principal)
	};
};
