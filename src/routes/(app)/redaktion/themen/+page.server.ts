import { themenActions, themenLaden } from '#lib/server/themen-seite.ts';
import type { PageServerLoad } from './$types';

/** Themen der Mediathek und FAQs für die Redaktion (Kap. 8.15, 10) */
export const load: PageServerLoad = ({ locals }) => themenLaden(locals);

export const actions = themenActions;
