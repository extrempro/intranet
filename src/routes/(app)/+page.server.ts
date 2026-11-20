import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { greeting, HOME_CARDS, resolveLayout } from '#lib/home.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import {
	getPreferences,
	listFavorites,
	removeFavorite,
	reorderFavorites,
	setHomeLayout
} from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

const ZONE = 'Europe/Berlin';

export const load: PageServerLoad = async ({ locals }) => {
	const principal = requirePrincipal(locals);
	const [prefs, favs, [tenant]] = await Promise.all([
		getPreferences(principal.personId),
		listFavorites(principal.personId),
		db
			.select({ homeDefault: tenants.homeDefault })
			.from(tenants)
			.where(eq(tenants.id, principal.tenantId))
	]);
	const now = new Date();
	const hour = Number(
		new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: ZONE }).format(
			now
		)
	);
	return {
		gruss: `${greeting(hour)}, ${locals.person!.displayName.split(/\s+/)[0]}`,
		datum: new Intl.DateTimeFormat('de-DE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: ZONE
		}).format(now),
		favoriten: favs.map((f) => ({
			key: f.key,
			label: f.label,
			beschreibung: f.description,
			href: f.href,
			icon: f.icon
		})),
		karten: resolveLayout(HOME_CARDS, prefs.homeLayout, tenant?.homeDefault),
		eigeneEinstellung: prefs.homeLayout !== null
	};
};

function parseList(value: FormDataEntryValue | null): string[] | null {
	try {
		const v = JSON.parse(String(value ?? ''));
		return Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length <= 50 ? v : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	speichern: async ({ request, locals }) => {
		const principal = requirePrincipal(locals);
		const form = await request.formData();
		const order = parseList(form.get('reihenfolge'));
		const hidden = parseList(form.get('ausgeblendet'));
		const favs = parseList(form.get('favoriten'));
		if (!order || !hidden || !favs) return fail(400, { fehler: 'Ungültige Angaben.' });
		const known = new Set(HOME_CARDS.map((c) => c.id));
		await setHomeLayout(principal.personId, {
			order: order.filter((id) => known.has(id)),
			hidden: hidden.filter((id) => known.has(id))
		});
		await reorderFavorites(principal.personId, favs);
		// Entfernte Favoriten
		for (const f of await listFavorites(principal.personId)) {
			if (!favs.includes(f.key)) await removeFavorite(principal.personId, f.key);
		}
		return { gespeichert: true };
	},

	zuruecksetzen: async ({ locals }) => {
		const principal = requirePrincipal(locals);
		await setHomeLayout(principal.personId, null);
		return { zurueckgesetzt: true };
	}
};
