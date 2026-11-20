import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listDepartments } from '#lib/server/departments.ts';
import { listHubs } from '#lib/server/hubs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [abteilungen, hubs] = await Promise.all([listDepartments(p), listHubs(p)]);
	const n = (zahl: number, eins: string, viele: string) =>
		zahl === 1 ? `1 ${eins}` : `${zahl} ${viele}`;
	return {
		texte: {
			abteilungen: abteilungen.length
				? `${n(abteilungen.length, 'Einheit', 'Einheiten')} mit Ansprechpersonen`
				: null,
			hubs: hubs.length ? `${n(hubs.length, 'Thema', 'Themen')} für alle` : null
		} as Record<string, string | null>
	};
};
