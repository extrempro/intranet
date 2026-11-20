import { error } from '@sveltejs/kit';
import { buildIcs } from '#lib/calendar.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getEvent } from '#lib/server/calendar.ts';
import type { RequestHandler } from './$types';

/** Einzelner Termin als .ics („In Kalender“), mit Beschreibung. */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const ev = await getEvent(requirePrincipal(locals), params.id);
	if (!ev) error(404, 'Diesen Termin gibt es nicht oder nicht mehr.');
	const ics = buildIcs([{ ...ev, sender: ev.unitName }], { name: ev.title, host: url.hostname });
	return new Response(ics, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'attachment; filename="termin.ics"',
			'Cache-Control': 'private, no-store'
		}
	});
};
