import { error } from '@sveltejs/kit';
import { version } from '$app/env';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { backupStatus, systemStatus } from '#lib/server/system.ts';
import type { PageServerLoad } from './$types';

/** System (Kap. 14): Version, Zustand, Sicherungen. Betrifft alle Mandanten, daher nur System-Admins. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!isSystemAdmin(requirePrincipal(locals))) error(403, 'Dafür fehlt dir das Recht.');
	return {
		system: await systemStatus(version),
		sicherung: await backupStatus()
	};
};
