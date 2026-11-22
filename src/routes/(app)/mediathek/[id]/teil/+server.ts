import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { MediathekFehler, teilAnhaengen, uploadStand } from '#lib/server/mediathek.ts';
import { TEIL_BYTES } from '#lib/mediathek.ts';

/** Einen Teil des Videos anhängen (?offset=<bisher erhaltene Bytes>). Nur gleiche Herkunft. */
export const PUT: RequestHandler = async ({ request, locals, url, params }) => {
	const p = requirePrincipal(locals);
	if (request.headers.get('origin') !== url.origin) error(403, 'Ungültige Herkunft');
	const offset = Number(url.searchParams.get('offset'));
	if (!Number.isSafeInteger(offset) || offset < 0)
		return json({ fehler: 'Ungültiger Teil.' }, { status: 400 });
	if (Number(request.headers.get('content-length') ?? 0) > TEIL_BYTES)
		return json({ fehler: 'Teil zu groß.' }, { status: 413 });
	const teil = new Uint8Array(await request.arrayBuffer());
	try {
		return json(await teilAnhaengen(p, params.id as string, offset, teil));
	} catch (err) {
		if (err instanceof MediathekFehler)
			return json({ fehler: err.message }, { status: err.status });
		throw err;
	}
};

/** Stand eines abgebrochenen Uploads (nur für die Person, die hochlädt) */
export const GET: RequestHandler = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	try {
		return json(await uploadStand(p, params.id as string), {
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (err) {
		if (err instanceof MediathekFehler)
			return json({ fehler: err.message }, { status: err.status });
		throw err;
	}
};
