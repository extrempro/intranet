import { eq, inArray } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { persons, units } from '#lib/server/db/schema.ts';
import { myHubs } from '#lib/server/hubs.ts';
import { benachrichtigungsDaten, standortDaten } from '#lib/server/konto.ts';
import { getOwnProfile } from '#lib/server/people.ts';
import { getVersionHint, resetHelpSeen, setVersionHint } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

/** Konto als eine Seite (Entwurf): Profil, Standorte, Kontakt, Benachrichtigungen, Weiteres. */
export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const unitIds = p.memberships.map((m) => m.unitId);
	const [profil, standorte, benachrichtigungen, hubs, [person], einheiten, neuerungen] =
		await Promise.all([
			getOwnProfile(p),
			standortDaten(p),
			benachrichtigungsDaten(p),
			myHubs(p),
			db.select({ quelle: persons.authSource }).from(persons).where(eq(persons.id, p.personId)),
			unitIds.length
				? db
						.select({ name: units.name, type: units.type })
						.from(units)
						.where(inArray(units.id, unitIds))
				: Promise.resolve([]),
			getVersionHint(p.personId)
		]);
	return {
		profil,
		standorte,
		benachrichtigungen,
		hubs: {
			anzahl: hubs.length,
			eigene: hubs.filter((h) => h.push || h.email || !h.bell).length
		},
		anmeldung:
			person?.quelle === 'entra' ? 'angemeldet über Microsoft (Entra ID)' : 'lokales Konto',
		einheiten: einheiten
			.filter((u) => u.type !== 'hub')
			.map((u) => u.name)
			.slice(0, 2),
		theme: locals.theme,
		/** Hinweis „Neu in Version …“ nach einem Update */
		neuerungen: neuerungen.an
	};
};

export const actions: Actions = {
	einfuehrungen: async ({ locals }) => {
		await resetHelpSeen(requirePrincipal(locals).personId);
		return { bereich: 'hilfe', zurueckgesetzt: true };
	},

	neuerungen: async ({ request, locals }) => {
		const an = String((await request.formData()).get('wert') ?? '') === 'an';
		await setVersionHint(requirePrincipal(locals).personId, an);
		return { bereich: 'neuerungen', gespeichert: true };
	}
};
