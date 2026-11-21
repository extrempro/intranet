import { error, json, type RequestHandler } from '@sveltejs/kit';
import { mitPasskeyBestaetigen, passkeyOptionen } from '#lib/server/auth/bestaetigung.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';

/** Erneute Anmeldung mit Passkey: Optionen holen und Antwort prüfen */
export const POST: RequestHandler = async ({ locals, request, url, getClientAddress }) => {
	requirePrincipal(locals);
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'Ungültige Anfrage');
	const body = (await request.json().catch(() => null)) as {
		aktion?: string;
		antwort?: unknown;
	} | null;
	if (body?.aktion === 'optionen') {
		const options = await passkeyOptionen(locals, url.origin);
		if (!options) error(400, 'Kein Passkey vorhanden');
		return json(options);
	}
	if (body?.aktion === 'pruefen') {
		const r = await mitPasskeyBestaetigen(
			locals,
			body.antwort as Parameters<typeof mitPasskeyBestaetigen>[1],
			url.origin,
			getClientAddress()
		);
		if (r.ok) return json({ ok: true, bis: r.bis.toISOString() });
		return json(
			{ ok: false, warten: r.grund === 'warten' ? r.sekunden : undefined },
			{ status: r.grund === 'warten' ? 429 : 400 }
		);
	}
	error(400, 'Ungültige Anfrage');
};
