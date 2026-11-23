import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { umfrageCsv } from '#lib/server/umfragen.ts';
import type { RequestHandler } from './$types';

/** Antworten einer Umfrage als CSV, nur für das Team der Einheit (Kap. 8.16). */
export const GET: RequestHandler = async ({ locals, params }) => {
	const r = await umfrageCsv(requirePrincipal(locals), params.id);
	if (!r) error(404, 'Diese Umfrage gibt es nicht, oder dir fehlt das Recht für die Auswertung.');
	return new Response(r.csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${r.name}"`,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
