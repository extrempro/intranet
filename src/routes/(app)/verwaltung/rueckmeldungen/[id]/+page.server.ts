import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	askReporter,
	FeedbackError,
	getFeedback,
	setFeedbackStatus
} from '#lib/server/feedback.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const r = await getFeedback(requirePrincipal(locals), params.id);
	if (!r) error(404, 'Diese Rückmeldung gibt es nicht oder nicht mehr.');
	return { r };
};

export const actions: Actions = {
	stand: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		try {
			await setFeedbackStatus(
				requirePrincipal(locals),
				params.id,
				String(f.get('stand') ?? ''),
				String(f.get('antwort') ?? '').slice(0, 2000),
				getClientAddress()
			);
		} catch (err) {
			if (err instanceof FeedbackError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { gespeichert: true };
	},
	rueckfrage: async ({ locals, params }) => {
		let id: string;
		try {
			id = await askReporter(requirePrincipal(locals), params.id);
		} catch (err) {
			if (err instanceof FeedbackError) return fail(400, { fehler: err.message });
			throw err;
		}
		redirect(303, `/nachrichten/${id}`);
	}
};
