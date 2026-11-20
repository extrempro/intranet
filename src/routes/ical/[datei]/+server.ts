import { error } from '@sveltejs/kit';
import { buildIcs } from '#lib/calendar.ts';
import { feedEvents } from '#lib/server/calendar.ts';
import type { RequestHandler } from './$types';

/**
 * Persönliches Kalender-Abo ohne Anmeldung (Kap. 8.8). Der Link ist das
 * Geheimnis; er enthält nur Titel, Zeit, Ort und Absender.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const token = params.datei.replace(/\.ics$/, '');
	const list = await feedEvents(token);
	if (!list) error(404, 'Diesen Kalender gibt es nicht oder der Link ist gesperrt.');
	return new Response(buildIcs(list, { name: 'Intranet', host: url.hostname, feed: true }), {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': 'inline; filename="intranet.ics"',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex',
			'Referrer-Policy': 'no-referrer'
		}
	});
};
