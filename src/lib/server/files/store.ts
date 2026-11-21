/**
 * Dateiablage im Volume (FILES_DIR, im Container /data/files).
 * Ablage: <FILES_DIR>/<erste 2 Zeichen der ID>/<ID>, Inhalt verschlüsselt.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { files } from '../db/schema.ts';
import { decryptFile, encryptFile, newFileKey, unwrapFileKey } from './crypto.ts';
import { detectKind, MIME, safeFileName, type FileKind } from './types.ts';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

export class FileError extends Error {}

function root(): string {
	return resolve(process.env.FILES_DIR ?? 'data/files');
}

function pathFor(id: string): string {
	if (!/^[0-9a-f-]{36}$/.test(id)) throw new FileError('Ungültige Datei');
	return join(root(), id.slice(0, 2), id);
}

/** Prüft und speichert eine hochgeladene Datei (noch ohne Verknüpfung). */
export async function storeUpload(file: File, personId: string) {
	if (file.size === 0) throw new FileError('Die Datei ist leer.');
	if (file.size > MAX_FILE_BYTES) throw new FileError('Die Datei ist größer als 20 MB.');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const kind = detectKind(bytes);
	if (!kind) {
		throw new FileError(
			'Dieser Dateityp ist nicht erlaubt. Erlaubt sind PDF, JPG, PNG, WebP, Word, Excel und PowerPoint (ohne Makros).'
		);
	}
	return storeBytes(bytes, safeFileName(file.name, kind), kind, personId);
}

/** Geprüfte Bytes verschlüsselt ablegen (ohne Verknüpfung). */
export async function storeBytes(
	bytes: Uint8Array,
	name: string,
	kind: FileKind,
	personId: string
) {
	const { key, keyEnc } = newFileKey();
	const [row] = await db
		.insert(files)
		.values({
			name,
			mime: MIME[kind],
			kind,
			size: bytes.length,
			keyEnc,
			createdBy: personId
		})
		.returning({ id: files.id, name: files.name, size: files.size, kind: files.kind });
	try {
		const target = pathFor(row.id);
		await mkdir(join(root(), row.id.slice(0, 2)), { recursive: true, mode: 0o700 });
		await writeFile(target, encryptFile(bytes, key, row.id), { mode: 0o600, flag: 'wx' });
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
	const data = decryptFile(await readFile(pathFor(id)), unwrapFileKey(row.keyEnc), id);
	return { ...row, kind: row.kind as FileKind, data };
}

/** Löscht Schlüssel und Datei. Ohne Schlüssel ist die Datei ohnehin unlesbar. */
export async function deleteStored(ids: string[]) {
	if (ids.length === 0) return;
	await db.delete(files).where(inArray(files.id, ids));
	await Promise.all(ids.map((id) => rm(pathFor(id), { force: true })));
}

/**
 * Hochgeladene, aber nie verknüpfte Dateien nach 24 Stunden löschen.
 * Jede Tabelle, die auf Dateien verweist, muss hier stehen.
 */
export async function deleteOrphans() {
	const rows = await db
		.select({ id: files.id })
		.from(files)
		.where(and(lt(files.createdAt, sql`now() - interval '24 hours'`), unlinked));
	await deleteStored(rows.map((r) => r.id));
}

/** Datei hängt nirgends: Jede Tabelle, die auf Dateien verweist, muss hier stehen. */
const unlinked = sql`not exists (select 1 from news_attachments a where a.file_id = ${files.id})
	and not exists (select 1 from faq_attachments fa where fa.file_id = ${files.id})
	and not exists (select 1 from plans pl where pl.file_id = ${files.id})
	and not exists (select 1 from org_chart o where o.file_id = ${files.id})
	and not exists (select 1 from menus m where m.file_id = ${files.id})
	and not exists (select 1 from board_ad_photos bp where bp.file_id = ${files.id})
	and not exists (select 1 from persons pp where pp.photo_file_id = ${files.id})
	and not exists (select 1 from agreement_attachments ag where ag.file_id = ${files.id})
	and not exists (select 1 from legal_links ll where ll.file_id = ${files.id})
	and not exists (select 1 from feedback fb where fb.screenshot_file_id = ${files.id})`;

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
export async function storePdf(file: File, personId: string) {
	const stored = await storeUpload(file, personId);
	if (stored.kind !== 'pdf') {
		await deleteStored([stored.id]);
		throw new FileError('Hier sind nur PDF-Dateien erlaubt.');
	}
	return stored;
}
