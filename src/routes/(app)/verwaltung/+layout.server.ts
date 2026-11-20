import { error } from '@sveltejs/kit';
import { canSeeAdministration } from '#lib/server/auth/access.ts';
import type { LayoutServerLoad } from './$types';

/**
 * Verwaltung nur für Mandanten- und System-Admins (Kap. 14).
 * Jede Aktion prüft ihr Recht zusätzlich selbst (Layouts schützen keine Actions).
 */
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.principal || !canSeeAdministration(locals.principal)) {
		error(403, 'Dafür fehlt dir das Recht.');
	}
	return {};
};
