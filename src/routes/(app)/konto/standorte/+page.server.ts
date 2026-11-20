import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { allLocations, myLocationIds, setMyLocations } from '#lib/server/canteen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const [alle, meine] = await Promise.all([allLocations(), myLocationIds(p.personId)]);
	return { alle, meine };
};

export const actions: Actions = {
	standorte: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		await setMyLocations(p.personId, f.getAll('standort').map(String));
		return { gespeichert: true };
	}
};
