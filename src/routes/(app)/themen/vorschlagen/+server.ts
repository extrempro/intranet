import { error, json } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { ThemaFehler, vorschlagen } from '#lib/server/themen.ts';
import type { RequestHandler } from './$types';

/** Thema für Mediathek und FAQs vorschlagen (Kap. 8.15); entscheiden System-Admins. */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const p = requirePrincipal(locals);
	if (request.headers.get('origin') !== url.origin) error(403, 'Ungültige Herkunft');
	const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
	try {
		const name = await vorschlagen(p.personId, body?.name);
		return json({ ok: true, name });
	} catch (err) {
		if (err instanceof ThemaFehler)
			return json({ ok: false, fehler: err.message }, { status: 400 });
		throw err;
	}
};
