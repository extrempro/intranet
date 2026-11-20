import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listFeedback } from '#lib/server/feedback.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const status = url.searchParams.get('stand') ?? 'offen';
	const kind = url.searchParams.get('art') ?? '';
	return {
		liste: await listFeedback(requirePrincipal(locals), { status, kind }),
		filter: { status, kind }
	};
};
