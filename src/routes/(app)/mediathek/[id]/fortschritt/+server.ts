import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { merken } from '#lib/server/fortschritt.ts';
import type { RequestHandler } from './$types';

/** Stand beim Ansehen merken (Kap. 8.15). Nur gleiche Herkunft, kein Protokoll. */
export const POST: RequestHandler = async ({ request, locals, url, params }) => {
	const p = requirePrincipal(locals);
	if (request.headers.get('origin') !== url.origin) error(403, 'Ungültige Herkunft');
	if (Number(request.headers.get('content-length') ?? 0) > 200) error(413, 'Zu groß');
	const body = (await request.json().catch(() => null)) as { s?: unknown } | null;
	const s = Number(body?.s);
	if (!Number.isFinite(s) || s < 0 || s > 24 * 3600) error(400, 'Ungültige Position');
	await merken(p, params.id, s);
	return new Response(null, { status: 204 });
};
