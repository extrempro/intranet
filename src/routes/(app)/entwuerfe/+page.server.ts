import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { darfEntwurf, entwuerfeListe, entwurfLoeschen } from '#lib/server/entwuerfe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	if (!darfEntwurf(p)) error(403, 'Dafür fehlt dir das Recht.');
	return { entwuerfe: await entwuerfeListe(p) };
};

export const actions: Actions = {
	loeschen: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const id = String((await request.formData()).get('id') ?? '');
		await entwurfLoeschen(p, id);
		return { geloescht: true };
	}
};
