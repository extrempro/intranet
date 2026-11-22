import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { ownUnlinkedFiles, readStored } from '#lib/server/files/store.ts';
import { contentDisposition, INLINE } from '#lib/server/files/types.ts';
import { boardPhotoAllowed } from '#lib/server/board.ts';
import { menuFileAllowed } from '#lib/server/canteen.ts';
import { kulissenFileAllowed } from '#lib/server/kulissen.ts';
import { legalFileAllowed } from '#lib/server/legal.ts';
import { faqOfFile } from '#lib/server/faqs.ts';
import { videoDateiErlaubt } from '#lib/server/mediathek.ts';
import { feedbackScreenshotAllowed } from '#lib/server/feedback.ts';
import { textBildErlaubt } from '#lib/server/textbilder.ts';
import { hubDateiErlaubt } from '#lib/server/hub-inhalte.ts';
import { newsOfFile } from '#lib/server/news.ts';
import { isPublicDocument } from '#lib/server/plans.ts';
import type { RequestHandler } from './$types';

/**
 * Auslieferung nur nach Anmeldung und Rechteprüfung (Kap. 1.4, 16):
 * Die Datei muss zu einem Beitrag gehören, den die Person sehen darf.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = requirePrincipal(locals);
	// Betreiber: nur Speisepläne des eigenen Standorts. Sonst Anhang eines
	// sichtbaren Beitrags oder einer FAQ, Plan/Organigramm oder Speiseplan.
	const id = params.id;
	const allowed =
		/^[0-9a-f-]{36}$/i.test(id) &&
		(p.operatorLocationId
			? await menuFileAllowed(p, id)
			: (await isPublicDocument(id)) ||
				(await menuFileAllowed(p, id)) ||
				Boolean(await newsOfFile(p, id)) ||
				(await faqOfFile(p, id)) ||
				(await videoDateiErlaubt(p, id)) ||
				(await boardPhotoAllowed(p, id)) ||
				(await kulissenFileAllowed(p, id)) ||
				(await legalFileAllowed(p, id)) ||
				// Bild im Text eines Beitrags oder einer FAQ
				(await textBildErlaubt(p, id)) ||
				// Titelbild, Symbol oder Dokument eines sichtbaren Hubs
				(await hubDateiErlaubt(p, id)) ||
				// Bildschirmfoto einer Fehlermeldung (nur System-Admins)
				(await feedbackScreenshotAllowed(p, id)) ||
				// Eigener, noch nicht verknüpfter Upload (Vorschau im Formular)
				(await ownUnlinkedFiles(p.personId, [id])).length > 0);
	if (!allowed) error(404, 'Diese Datei gibt es nicht oder nicht mehr.');
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
