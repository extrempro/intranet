import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { videoDetail, videosListe } from '#lib/server/mediathek.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const v = await videoDetail(p, params.id);
	if (!v || !['entwurf', 'veroeffentlicht'].includes(v.status)) error(404, 'Video nicht gefunden');
	const mehr = (await videosListe(p, { unitId: v.unitId, limit: 8 })).filter(
		(x) => x.id !== v.id && x.status === 'veroeffentlicht'
	);
	return { v, mehr: mehr.slice(0, 4) };
};
