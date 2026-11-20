import { error } from '@sveltejs/kit';
import { version } from '$app/env';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { getEntraConfig } from '#lib/server/auth/entra.ts';
import { lastSync, syncRunning } from '#lib/server/auth/entra-sync.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { backupStatus, systemStatus } from '#lib/server/system.ts';
import type { PageServerLoad } from './$types';

function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Dafür fehlt dir das Recht.');
	return p;
}

/** System (Kap. 14): Version, Zustand, Sicherungen; Entra-Abgleich nur als Zustand (Pflege unter Anmeldung). Betrifft alle Mandanten, daher nur System-Admins. */
export const load: PageServerLoad = async ({ locals }) => {
	requireSystemAdmin(locals);
	return {
		system: await systemStatus(version),
		sicherung: await backupStatus(),
		abgleich: {
			eingerichtet: Boolean(await getEntraConfig()),
			laeuft: syncRunning(),
			letzter: await lastSync()
		}
	};
};
