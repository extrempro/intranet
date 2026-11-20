import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	allTenants,
	feedUnits,
	getFeed,
	renewFeed,
	revokeFeed,
	saveFeed
} from '#lib/server/calendar.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const feed = await getFeed(p, url.origin);
	const [mandanten, einheiten] = await Promise.all([
		allTenants(),
		feedUnits(p, feed.config.tenants)
	]);
	return {
		feed,
		mandanten: mandanten.map((m) => ({ ...m, eigener: m.id === p.tenantId })),
		einheiten
	};
};

export const actions: Actions = {
	speichern: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const mode = String(f.get('abteilungen') ?? 'all');
		await saveFeed(p, {
			tenants: f.getAll('mandanten').map(String),
			departments: mode === 'selected' || mode === 'none' ? mode : 'all',
			unitIds: f.getAll('einheiten').map(String),
			hubs: (['mine', 'all', 'none'] as const).find((h) => h === f.get('hubs')) ?? 'mine'
		});
		return { gespeichert: true };
	},
	erneuern: async ({ locals }) => {
		await renewFeed(requirePrincipal(locals));
		return { erneuert: true };
	},
	sperren: async ({ locals }) => {
		await revokeFeed(requirePrincipal(locals));
		return { gesperrt: true };
	}
};
