import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { abteilungSeiteActions } from '#lib/server/abteilung-seite.ts';
import { hubBeitraege } from '#lib/server/hub-seite.ts';
import type { PageServerLoad } from './$types';

/** Überblick: die neuesten Beiträge mit Vorschaubild */
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { einheit } = await parent();
	return hubBeitraege(requirePrincipal(locals), einheit.id, 3);
};

export const actions = abteilungSeiteActions;
