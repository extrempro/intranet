import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { CalendarError, deleteEvent, getEvent } from '#lib/server/calendar.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const ev = await getEvent(requirePrincipal(locals), params.id);
	if (!ev) error(404, 'Diesen Termin gibt es nicht oder nicht mehr.');
	return { termin: ev };
};

export const actions: Actions = {
	loeschen: async ({ locals, params }) => {
		try {
			await deleteEvent(requirePrincipal(locals), params.id);
		} catch (err) {
			if (err instanceof CalendarError) return fail(404, { fehler: err.message });
			throw err;
		}
		redirect(303, '/kalender');
	}
};
