import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	closeConversation,
	getConversation,
	MessageError,
	sendMessage
} from '#lib/server/messages.ts';
import { answerDeadline } from '#lib/server/hubs.ts';
import { messageLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const g = await getConversation(requirePrincipal(locals), params.id);
	if (!g) error(404, 'Dieses Gespräch gibt es nicht.');
	// Hub-Anträge: Antwortfrist, wenn die Rolle zuletzt geschrieben hat (Kap. 8.12)
	const frist = g.kind === 'hub_antrag' && !g.closedAt ? await answerDeadline(g.id) : null;
	return { gespraech: g, frist };
};

export const actions: Actions = {
	senden: async ({ request, locals, params }) => {
		const text = String((await request.formData()).get('text') ?? '').slice(0, 5000);
		const p = requirePrincipal(locals);
		if (!messageLimit.hit(p.personId))
			return fail(429, {
				fehler: 'Du hast gerade sehr viele Nachrichten geschickt. Warte bitte kurz.',
				text
			});
		try {
			await sendMessage(requirePrincipal(locals), params.id, text);
		} catch (err) {
			if (err instanceof MessageError) return fail(400, { fehler: err.message, text });
			throw err;
		}
		return { gesendet: true };
	},
	schliessen: async ({ locals, params }) => {
		try {
			await closeConversation(requirePrincipal(locals), params.id);
		} catch (err) {
			if (err instanceof MessageError) return fail(403, { fehler: err.message });
			throw err;
		}
		return { geschlossen: true };
	}
};
