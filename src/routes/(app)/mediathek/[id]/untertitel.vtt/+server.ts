import { error, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { untertitel } from '#lib/server/mediathek.ts';

export const GET: RequestHandler = async ({ locals, params }) => {
	const vtt = await untertitel(requirePrincipal(locals), params.id as string);
	if (vtt === null) error(404, 'Nicht gefunden');
	return new Response(vtt, {
		headers: {
			'Content-Type': 'text/vtt; charset=utf-8',
			'Cache-Control': 'private, no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
