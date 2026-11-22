import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { MediathekFehler, videoAnlegen } from '#lib/server/mediathek.ts';

/** Neues Video anlegen (danach Teile senden). Nur gleiche Herkunft. */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const p = requirePrincipal(locals);
	if (request.headers.get('origin') !== url.origin) error(403, 'Ungültige Herkunft');
	const body = (await request.json().catch(() => null)) as {
		unitId?: unknown;
		title?: unknown;
		size?: unknown;
	} | null;
	try {
		const id = await videoAnlegen(p, {
			unitId: String(body?.unitId ?? ''),
			title: String(body?.title ?? ''),
			size: Number(body?.size)
		});
		return json({ id });
	} catch (err) {
		if (err instanceof MediathekFehler)
			return json({ fehler: err.message }, { status: err.status });
		throw err;
	}
};
