import { error, fail, redirect } from '@sveltejs/kit';
import { berlinNow } from '#lib/canteen.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { allTenants, eventWritableUnits, saveEvent } from '#lib/server/calendar.ts';
import { readEventForm } from '#lib/server/event-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const einheiten = await eventWritableUnits(p);
	if (einheiten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const tag = url.searchParams.get('tag');
	return {
		einheiten,
		mandanten: await allTenants(),
		werte: {
			unitId: einheiten[0].id,
			title: '',
			date: tag && /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : berlinNow().date,
			allDay: false,
			startTime: '10:00',
			endTime: '11:00',
			place: '',
			description: '',
			allTenants: true,
			tenantIds: []
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const input = readEventForm(await request.formData());
		const r = await saveEvent(p, null, input);
		if (!r.ok) return fail(400, { werte: input, fehler: r.errors });
		redirect(303, `/kalender/${r.id}`);
	}
};
