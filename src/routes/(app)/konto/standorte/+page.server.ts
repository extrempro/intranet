import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { setMyLocations } from '#lib/server/canteen.ts';
import { standortDaten } from '#lib/server/konto.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => standortDaten(requirePrincipal(locals));

export const actions: Actions = {
	standorte: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		await setMyLocations(p.personId, f.getAll('standort').map(String));
		return { bereich: 'standorte', gespeichert: true };
	}
};
