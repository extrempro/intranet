import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { berlinHour, greeting, HOME_CARDS, resolveLayout } from '#lib/home.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listNews, urgentForBanner } from '#lib/server/news.ts';
import { todayAndTomorrow } from '#lib/server/calendar.ts';
import { subscribedHubIds } from '#lib/server/hubs.ts';
import { canteenCards } from '#lib/server/canteen.ts';
import { latestPlans } from '#lib/server/plans.ts';
import { persons, tenants } from '#lib/server/db/schema.ts';
import { vorname } from '#lib/vorname.ts';
import {
	getNewsSeen,
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
	const [
		prefs,
		favs,
		[tenant],
		dringend,
		neuigkeiten,
		plaene,
		kantinen,
		termine,
		hubBeitraege,
		neuSeit
	] = await Promise.all([
		getPreferences(principal.personId),
		listFavorites(principal.personId),
		db
			.select({ homeDefault: tenants.homeDefault })
			.from(tenants)
			.where(eq(tenants.id, principal.tenantId)),
		urgentForBanner(principal),
		listNews(principal, { limit: 5 }),
		latestPlans(principal),
		canteenCards(principal.personId),
		todayAndTomorrow(principal),
		subscribedHubIds(principal).then((ids) => listNews(principal, { unitIds: ids, limit: 4 })),
		getNewsSeen(principal.personId)
	]);
	const [ich] = await db
		.select({ givenName: persons.givenName })
		.from(persons)
		.where(eq(persons.id, principal.personId));
	const now = new Date();
	const hour = berlinHour(now);
	return {
		gruss: `${greeting(hour)}, ${vorname(locals.person!.displayName, ich?.givenName)}`,
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
		eigeneEinstellung: prefs.homeLayout !== null,
		dringend,
		neuigkeiten: neuigkeiten.filter((n) => !n.planned),
		plaene,
		kantinen,
		termine,
		hubBeitraege: hubBeitraege.filter((n) => !n.planned),
		/** Letzter Besuch der Neuigkeiten (für „neu“) */
		neuSeit
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
