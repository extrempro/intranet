import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { abteilungSeiteActions } from '#lib/server/abteilung-seite.ts';
import { interneTermine } from '#lib/server/calendar.ts';
import { hubBeitraege } from '#lib/server/hub-seite.ts';
import type { PageServerLoad } from './$types';

/**
 * Reiter „Intern“ (Kap. 8.17): Beiträge, Termine und Ordner nur für das Team.
 * Nur Mitglieder, Leitung, Stellvertretung und Abteilungsverwaltung; sonst 404.
 */
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { einheit } = await parent();
	if (!einheit.internErlaubt) error(404, 'Diese Seite gibt es nicht.');
	const p = requirePrincipal(locals);
	const [beitraege, termine] = await Promise.all([
		hubBeitraege(p, einheit.id, 20, 'nur'),
		interneTermine(p, einheit.id)
	]);
	return { ...beitraege, termine };
};

export const actions = abteilungSeiteActions;
