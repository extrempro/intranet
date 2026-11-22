import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { ersatzAnlegen, MediathekFehler } from '#lib/server/mediathek.ts';

/** Neue Fassung anlegen (danach Teile senden). Das Video bleibt bis zum Tausch online. */
export const POST: RequestHandler = async ({ request, locals, url, params }) => {
	const p = requirePrincipal(locals);
	if (request.headers.get('origin') !== url.origin) error(403, 'Ungültige Herkunft');
	const body = (await request.json().catch(() => null)) as { size?: unknown } | null;
	try {
		return json({ id: await ersatzAnlegen(p, params.id as string, Number(body?.size)) });
	} catch (err) {
		if (err instanceof MediathekFehler)
			return json({ fehler: err.message }, { status: err.status });
		throw err;
	}
};
