import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { boxesFor, listConversations } from '#lib/server/messages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const boxes = await boxesFor(p);
	const box = boxes.find((b) => b.key === url.searchParams.get('postfach')) ?? boxes[0];
	const erledigt = url.searchParams.get('status') === 'erledigt';
	return {
		boxes: boxes.map(({ key, label }) => ({ key, label })),
		box: box.key,
		rolle: box.tenantId !== null,
		erledigt,
		liste: await listConversations(p, box, erledigt)
	};
};
