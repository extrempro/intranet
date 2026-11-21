import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { boxesFor, listConversations } from '#lib/server/messages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const boxes = await boxesFor(p);
	const box = boxes.find((b) => b.key === url.searchParams.get('postfach')) ?? boxes[0];
	const erledigt = url.searchParams.get('status') === 'erledigt';
	// Zähler an den Reitern: offene Gespräche je Postfach, erledigte im gewählten
	const [offen, erledigte] = await Promise.all([
		Promise.all(boxes.map((b) => listConversations(p, b, false))),
		listConversations(p, box, true)
	]);
	const i = boxes.indexOf(box);
	return {
		boxes: boxes.map(({ key, label }, n) => ({ key, label, offen: offen[n].length })),
		box: box.key,
		rolle: box.tenantId !== null,
		erledigt,
		anzahl: { offen: offen[i].length, erledigt: erledigte.length },
		liste: erledigt ? erledigte : offen[i]
	};
};
