import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { schreibbareEinheiten } from '#lib/server/mediathek.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const einheiten = await schreibbareEinheiten(requirePrincipal(locals));
	if (!einheiten.length) error(403, 'Dafür fehlt dir das Recht.');
	const wunsch = url.searchParams.get('einheit');
	return { einheiten, einheit: einheiten.some((u) => u.id === wunsch) ? wunsch : einheiten[0].id };
};
