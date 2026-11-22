import { error, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { medium } from '#lib/server/mediathek.ts';

/** Stücke, Wiedergabelisten und Vorschaubild: nur nach Rechteprüfung, entschlüsselt. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const m = await medium(p, params.id as string, params.pfad as string);
	if (!m) error(404, 'Nicht gefunden');
	return new Response(new Uint8Array(m.data), {
		headers: {
			'Content-Type': m.mime,
			'Cache-Control': 'private, max-age=3600',
			'X-Content-Type-Options': 'nosniff',
			'Content-Disposition': 'inline'
		}
	});
};
