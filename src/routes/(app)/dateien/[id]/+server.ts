import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readStored } from '#lib/server/files/store.ts';
import { contentDisposition, INLINE } from '#lib/server/files/types.ts';
import { newsOfFile } from '#lib/server/news.ts';
import type { RequestHandler } from './$types';

/**
 * Auslieferung nur nach Anmeldung und Rechteprüfung (Kap. 1.4, 16):
 * Die Datei muss zu einem Beitrag gehören, den die Person sehen darf.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = requirePrincipal(locals);
	if (!(await newsOfFile(p, params.id))) error(404, 'Diese Datei gibt es nicht oder nicht mehr.');
	const file = await readStored(params.id);
	if (!file) error(404, 'Diese Datei gibt es nicht oder nicht mehr.');
	const inline = INLINE.has(file.kind) && url.searchParams.get('download') === null;
	return new Response(new Uint8Array(file.data), {
		headers: {
			'Content-Type': file.mime,
			'Content-Length': String(file.data.length),
			'Content-Disposition': contentDisposition(file.name, inline),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'same-origin',
			// Bilder wie fremde Dokumente behandeln. PDFs nicht: Chrome blockiert
			// seinen PDF-Viewer in einer Sandbox; Office geht ohnehin als Download.
			...(file.kind === 'pdf'
				? { 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'" }
				: {
						'Content-Security-Policy':
							"sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
					})
		}
	});
};
