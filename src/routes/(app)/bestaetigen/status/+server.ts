import { json, type RequestHandler } from '@sveltejs/kit';
import { bestaetigtBis, bestaetigungsWege } from '#lib/server/auth/bestaetigung.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';

/** Für den Dialog: wie bestätigt werden kann und bis wann die Bestätigung gilt */
export const GET: RequestHandler = async ({ locals }) => {
	requirePrincipal(locals);
	return json(
		{ bis: bestaetigtBis(locals)?.toISOString() ?? null, wege: await bestaetigungsWege(locals) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
