import { fail } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import {
	clearIdleCache,
	DEFAULT_IDLE,
	IDLE_OPTIONS,
	type IdleOption
} from '#lib/server/auth/session.ts';
import { audit } from '#lib/server/audit.ts';
import { getSetting, setSetting } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const principal = requirePrincipal(locals);
	requireThat(isSystemAdmin(principal));
	return { idle: await getSetting<string>('session.idle', DEFAULT_IDLE) };
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		requireThat(isSystemAdmin(principal));
		const value = String((await request.formData()).get('idle') ?? '');
		if (!Object.hasOwn(IDLE_OPTIONS, value)) return fail(400, { fehler: 'Ungültiger Wert.' });

		const before = await getSetting<string>('session.idle', DEFAULT_IDLE);
		await setSetting('session.idle', value as IdleOption, principal.personId);
		clearIdleCache();
		await audit({
			category: 'admin',
			action: 'settings.update',
			actorId: principal.personId,
			entityType: 'setting',
			entityId: 'session.idle',
			details: { vorher: before, nachher: value },
			ip: getClientAddress()
		});
		return { gespeichert: true };
	}
};
