import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listNotifications, markAllRead } from '#lib/server/notify.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import type { Actions, PageServerLoad } from './$types';

/** Benachrichtigungen je Schritt „ältere laden“ (Kap. 6.7) */
const SCHRITT = 30;

export const load: PageServerLoad = async ({ locals, url }) => {
	const anzahl = anzahlAus(url, SCHRITT, 5000);
	const liste = await listNotifications(requirePrincipal(locals).personId, anzahl);
	return {
		liste,
		gesamt: liste[0]?.gesamt ?? 0,
		ungelesen: liste[0]?.ungelesen ?? 0,
		anzahl,
		schritt: SCHRITT
	};
};

export const actions: Actions = {
	alleGelesen: async ({ locals }) => {
		await markAllRead(requirePrincipal(locals).personId);
		return { erledigt: true };
	}
};
