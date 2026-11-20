import { error, json } from '@sveltejs/kit';
import { isTourKey } from '#lib/tours.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { markHelpSeen } from '#lib/server/preferences.ts';
import type { RequestHandler } from './$types';

/** Führung bzw. Einführung als gesehen merken (nur bekannte Schlüssel). */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (request.headers.get('origin') !== url.origin) error(403, 'Nicht erlaubt.');
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'JSON erwartet.');
	const p = requirePrincipal(locals);
	let key = '';
	try {
		key = String((JSON.parse((await request.text()).slice(0, 500)) as { key?: unknown }).key ?? '');
	} catch {
		error(400, 'Ungültig.');
	}
	if (!isTourKey(key)) error(400, 'Unbekannt.');
	await markHelpSeen(p.personId, key);
	return json({ ok: true });
};
