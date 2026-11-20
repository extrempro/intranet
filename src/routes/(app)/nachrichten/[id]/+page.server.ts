import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	closeConversation,
	getConversation,
	MessageError,
	sendMessage
} from '#lib/server/messages.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const g = await getConversation(requirePrincipal(locals), params.id);
	if (!g) error(404, 'Dieses Gespräch gibt es nicht.');
	return { gespraech: g };
};

export const actions: Actions = {
	senden: async ({ request, locals, params }) => {
		const text = String((await request.formData()).get('text') ?? '').slice(0, 5000);
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
