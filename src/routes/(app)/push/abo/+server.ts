import { error, json } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { PushError, subscribe, unsubscribe } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

/** Nur von der eigenen Seite (zusätzlich zu SameSite-Cookie und JSON-Preflight). */
function sameOrigin(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin) error(403, 'Nicht erlaubt.');
}

async function body(request: Request) {
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'JSON erwartet.');
	const text = await request.text();
	if (text.length > 4000) error(413, 'Zu groß.');
	try {
		return JSON.parse(text) as {
			endpoint?: unknown;
			keys?: { p256dh?: unknown; auth?: unknown };
		};
	} catch {
		error(400, 'Ungültig.');
	}
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	sameOrigin(request, url);
	const p = requirePrincipal(locals);
	const b = await body(request);
	try {
		await subscribe(
			p,
			{
				endpoint: String(b.endpoint ?? ''),
				p256dh: String(b.keys?.p256dh ?? ''),
				auth: String(b.keys?.auth ?? '')
			},
			request.headers.get('user-agent') ?? ''
		);
	} catch (err) {
		if (err instanceof PushError) error(400, err.message);
		throw err;
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals, url }) => {
	sameOrigin(request, url);
	const b = await body(request);
	await unsubscribe(requirePrincipal(locals), String(b.endpoint ?? '').slice(0, 1000));
	return json({ ok: true });
};
