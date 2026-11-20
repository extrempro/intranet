import { error, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { openNotification } from '#lib/server/notify.ts';
import type { PageServerLoad } from './$types';

/** Öffnen: als gelesen markieren und zum Ziel weiterleiten (nur interne Pfade). */
export const load: PageServerLoad = async ({ locals, params }) => {
	const ziel = await openNotification(requirePrincipal(locals).personId, params.id);
	if (!ziel) error(404, 'Diese Benachrichtigung gibt es nicht mehr.');
	redirect(303, ziel);
};
