import { error, fail } from '@sveltejs/kit';
import { version } from '$app/env';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { getEntraConfig } from '#lib/server/auth/entra.ts';
import { lastSync, runEntraSync, syncRunning, syncTime } from '#lib/server/auth/entra-sync.ts';
import { audit } from '#lib/server/audit.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { backupStatus, systemStatus } from '#lib/server/system.ts';
import type { Actions, PageServerLoad } from './$types';

function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Dafür fehlt dir das Recht.');
	return p;
}

/** System (Kap. 14): Version, Zustand, Sicherungen, Entra-Abgleich. Betrifft alle Mandanten, daher nur System-Admins. */
export const load: PageServerLoad = async ({ locals }) => {
	requireSystemAdmin(locals);
	return {
		system: await systemStatus(version),
		sicherung: await backupStatus(),
		abgleich: {
			eingerichtet: Boolean(await getEntraConfig()),
			uhrzeit: syncTime(),
			laeuft: syncRunning(),
			letzter: await lastSync()
		}
	};
};

export const actions: Actions = {
	/** Startet den Abgleich im Hintergrund; die Seite zeigt „läuft“. */
	abgleichen: async ({ locals, request, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		if (!(await getEntraConfig()))
			return fail(400, { fehler: 'Die Anmeldung mit Microsoft ist nicht eingerichtet.' });
		if (syncRunning()) return fail(409, { fehler: 'Der Abgleich läuft bereits.' });
		const trotzdem = (await request.formData()).get('trotzdem') === 'ja';
		await audit({
			category: 'admin',
			action: 'entra.sync_start',
			actorId: p.personId,
			details: { trotzdem },
			ip: getClientAddress()
		});
		void runEntraSync({ ausgeloest: 'hand', trotzdem }).catch((err) =>
			console.error('Entra-Abgleich fehlgeschlagen:', err)
		);
		return { gestartet: true };
	}
};
