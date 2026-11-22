/**
 * Dateiablage: Inhalt verschlüsselt, abgelegt am Speicherort der Inhaltsart
 * (lokal im Volume FILES_DIR oder in einem S3-Speicher, siehe speicherorte.ts).
 */
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { files } from '../db/schema.ts';
import { decryptFile, encryptFile, newFileKey, unwrapFileKey } from './crypto.ts';
import { detectKind, MIME, safeFileName, type FileKind } from './types.ts';
import { stripWebp, WebpError } from './webp.ts';
import { objektLesen, objektLoeschen, objektSchreiben, zielFuer } from './speicherorte.ts';
import type { Kategorie } from '../../speicher.ts';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export class FileError extends Error {}

/** Prüft und speichert eine hochgeladene Datei (noch ohne Verknüpfung). */
export async function storeUpload(file: File, personId: string, category: Kategorie) {
	if (file.size === 0) throw new FileError('Die Datei ist leer.');
	if (file.size > MAX_FILE_BYTES) throw new FileError('Die Datei ist größer als 20 MB.');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const kind = detectKind(bytes);
	if (!kind) {
		throw new FileError(
			'Dieser Dateityp ist nicht erlaubt. Erlaubt sind PDF, JPG, PNG, WebP, Word, Excel und PowerPoint (ohne Makros).'
		);
	}
	// WebP: Metadaten (EXIF, XMP) entfernen; Animation bleibt
	let inhalt: Uint8Array = bytes;
	if (kind === 'webp') {
		try {
			inhalt = stripWebp(bytes);
		} catch (err) {
			if (err instanceof WebpError) throw new FileError('Dieses WebP-Bild ist beschädigt.');
			throw err;
		}
	}
	return storeBytes(inhalt, safeFileName(file.name, kind), kind, personId, category);
}

/** Geprüfte Bytes verschlüsselt ablegen (ohne Verknüpfung). */
export async function storeBytes(
	bytes: Uint8Array,
	name: string,
	kind: FileKind,
	personId: string,
	category: Kategorie
) {
	const { key, keyEnc } = newFileKey();
	const ziel = await zielFuer(category);
	const [row] = await db
		.insert(files)
		.values({
			name,
			mime: MIME[kind],
			kind,
			size: bytes.length,
			keyEnc,
			category,
			storageTargetId: ziel,
			createdBy: personId
		})
		.returning({ id: files.id, name: files.name, size: files.size, kind: files.kind });
	try {
		await objektSchreiben(ziel, row.id, encryptFile(bytes, key, row.id));
	} catch (err) {
		await db.delete(files).where(eq(files.id, row.id));
		throw err;
	}
	return row as { id: string; name: string; size: number; kind: FileKind };
}

/** Entschlüsselter Inhalt; die Rechteprüfung macht der Aufrufer. */
export async function readStored(id: string) {
	const [row] = await db.select().from(files).where(eq(files.id, id));
	if (!row) return null;
	const data = decryptFile(
		await objektLesen(row.storageTargetId, id),
		unwrapFileKey(row.keyEnc),
		id
	);
	return { ...row, kind: row.kind as FileKind, data };
}

/** Löscht Schlüssel und Datei. Ohne Schlüssel ist die Datei ohnehin unlesbar. */
export async function deleteStored(ids: string[]) {
	if (ids.length === 0) return;
	const rows = await db
		.delete(files)
		.where(inArray(files.id, ids))
		.returning({ id: files.id, ziel: files.storageTargetId });
	// Ohne Schlüssel ist der Inhalt unlesbar; Fehler beim Entfernen nur protokollieren
	const ergebnisse = await Promise.allSettled(rows.map((r) => objektLoeschen(r.ziel, r.id)));
	for (const e of ergebnisse)
		if (e.status === 'rejected') console.warn('Datei am Speicherort nicht gelöscht');
}

/**
 * Hochgeladene, aber nie verknüpfte Dateien nach 24 Stunden löschen.
 * Jede Tabelle, die auf Dateien verweist, muss hier stehen.
 */
export async function deleteOrphans() {
	const rows = await db
		.select({ id: files.id })
		.from(files)
		.where(
			and(
				lt(files.createdAt, sql`now() - interval '24 hours'`),
				unlinked,
				// Dateien in Entwürfen bleiben, bis der Entwurf gelöscht ist
				sql`not exists (select 1 from draft_files df where df.file_id = ${files.id})`
			)
		);
	await deleteStored(rows.map((r) => r.id));
}

/** Datei hängt nirgends: Jede Tabelle, die auf Dateien verweist, muss hier stehen. */
const unlinked = sql`not exists (select 1 from news_attachments a where a.file_id = ${files.id})
	and not exists (select 1 from faq_attachments fa where fa.file_id = ${files.id})
	and not exists (select 1 from video_attachments va where va.file_id = ${files.id})
	and not exists (select 1 from plans pl where pl.file_id = ${files.id})
	and not exists (select 1 from org_chart o where o.file_id = ${files.id})
	and not exists (select 1 from menus m where m.file_id = ${files.id})
	and not exists (select 1 from board_ad_photos bp where bp.file_id = ${files.id})
	and not exists (select 1 from persons pp where pp.photo_file_id = ${files.id})
	and not exists (select 1 from agreement_attachments ag where ag.file_id = ${files.id})
	and not exists (select 1 from legal_links ll where ll.file_id = ${files.id})
	and not exists (select 1 from feedback fb where fb.screenshot_file_id = ${files.id})
	and not exists (select 1 from text_images ti where ti.file_id = ${files.id})
	and not exists (select 1 from unit_documents ud where ud.file_id = ${files.id})
	and not exists (select 1 from units un where un.cover_file_id = ${files.id} or un.icon_file_id = ${files.id})`;

/** Eigene, noch nirgends verknüpfte Uploads (für Anhänge). Liefert die gültigen IDs. */
export async function ownUnlinkedFiles(personId: string, ids: string[]): Promise<string[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.select({ id: files.id })
		.from(files)
		.where(and(inArray(files.id, ids), eq(files.createdBy, personId), unlinked));
	return rows.map((r) => r.id);
}

/** PDF hochladen (Pläne, Organigramm): andere Typen werden sofort wieder gelöscht. */
export async function storePdf(file: File, personId: string, category: Kategorie = 'plaene') {
	const stored = await storeUpload(file, personId, category);
	if (stored.kind !== 'pdf') {
		await deleteStored([stored.id]);
		throw new FileError('Hier sind nur PDF-Dateien erlaubt.');
	}
	return stored;
}
