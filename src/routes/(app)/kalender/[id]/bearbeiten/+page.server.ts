import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	allTenants,
	CalendarError,
	eventWritableUnits,
	getEvent,
	saveEvent
} from '#lib/server/calendar.ts';
import { readEventForm } from '#lib/server/event-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const ev = await getEvent(p, params.id);
	if (!ev?.canEdit) error(404, 'Diesen Termin gibt es nicht oder du darfst ihn nicht bearbeiten.');
	return {
		id: ev.id,
		einheiten: await eventWritableUnits(p),
		mandanten: await allTenants(),
		werte: {
			unitId: ev.unitId,
			title: ev.title,
			date: ev.date,
			allDay: ev.allDay,
			startTime: ev.startTime ?? '',
			endTime: ev.endTime ?? '',
			place: ev.place ?? '',
			description: ev.description ?? '',
			allTenants: ev.allTenants,
			tenantIds: ev.targets.map((t) => t.id),
			teamScope: ev.teamScope
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const input = readEventForm(await request.formData());
		try {
			const r = await saveEvent(p, params.id, input);
			if (!r.ok) return fail(400, { werte: input, fehler: r.errors });
		} catch (err) {
			if (err instanceof CalendarError) error(404, err.message);
			throw err;
		}
		redirect(303, `/kalender/${params.id}`);
	}
};
