import { error, json, type RequestHandler } from '@sveltejs/kit';
import { faqUnitIds, newsUnitIds } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { deleteStored, FileError, MAX_FILE_BYTES, storeUpload } from '#lib/server/files/store.ts';
import { formatSize } from '#lib/server/files/types.ts';
import { uploadLimit } from '#lib/server/rate-limit.ts';

/**
 * Hochladen einer Datei (einzeln, höchstens 20 MB). Alle Typen nur für Personen mit
 * Schreibrecht (Neuigkeiten oder FAQs); die Datei wird erst beim Speichern
 * des Beitrags bzw. der FAQ verknüpft,
 * sonst nach 24 Stunden gelöscht.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const p = requirePrincipal(locals);
	// Mit Schreibrecht alle erlaubten Typen; sonst nur Fotos (Schwarzes Brett)
	const writer =
		newsUnitIds(p).size > 0 ||
		faqUnitIds(p).size > 0 ||
		p.memberships.some((m) => m.mayWriteBehindScenes || m.mayWriteDocuments) ||
		// Hub-Team: Dokumente, Titelbild und Symbol
		p.roles.some((r) => r.role === 'hub_team');
	if (p.operatorLocationId) error(403, 'Dafür fehlt dir das Recht.');
	if (!uploadLimit.hit(p.personId))
		return json(
			{
				fehler:
					'Du hast in der letzten Stunde sehr viele Dateien hochgeladen. Versuch es bitte später noch einmal.'
			},
			{ status: 429, headers: { 'Retry-After': String(uploadLimit.retryAfter(p.personId)) } }
		);
	const length = Number(request.headers.get('content-length') ?? 0);
	if (length > MAX_FILE_BYTES + 64 * 1024)
		return json({ fehler: 'Die Datei ist größer als 20 MB.' }, { status: 413 });

	const form = await request.formData().catch(() => null);
	const file = form?.get('datei');
	if (!(file instanceof File)) return json({ fehler: 'Keine Datei erhalten.' }, { status: 400 });
	try {
		const stored = await storeUpload(file, p.personId, 'inhalte');
		if (!writer && !['jpeg', 'png', 'webp'].includes(stored.kind)) {
			await deleteStored([stored.id]);
			return json({ fehler: 'Hier sind nur Fotos (JPG, PNG, WebP) erlaubt.' }, { status: 400 });
		}
		return json({
			id: stored.id,
			name: stored.name,
			groesse: formatSize(stored.size),
			kind: stored.kind
		});
	} catch (err) {
		if (err instanceof FileError) return json({ fehler: err.message }, { status: 400 });
		throw err;
	}
};
