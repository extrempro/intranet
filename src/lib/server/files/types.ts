/**
 * Dateitypen werden am Inhalt erkannt (Magic Bytes), nicht an Endung oder
 * Angabe des Browsers (Kap. 16: Typprüfung beim Hochladen).
 */
export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'docx' | 'xlsx' | 'pptx';

export const MIME: Record<FileKind, string> = {
	pdf: 'application/pdf',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

export const EXTENSION: Record<FileKind, string> = {
	pdf: 'pdf',
	jpeg: 'jpg',
	png: 'png',
	webp: 'webp',
	docx: 'docx',
	xlsx: 'xlsx',
	pptx: 'pptx'
};

/** Im Browser ansehen statt herunterladen. */
export const INLINE: ReadonlySet<FileKind> = new Set(['pdf', 'jpeg', 'png', 'webp']);

const starts = (b: Uint8Array, sig: number[], offset = 0) =>
	sig.every((v, i) => b[offset + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Enthält der Puffer die Zeichenfolge? (für Namen im ZIP-Verzeichnis) */
function contains(b: Uint8Array, s: string): boolean {
	return Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes(s, 0, 'latin1');
}

/**
 * Erkennt den Typ; null = nicht erlaubt. Office nur als OOXML ohne Makros
 * (kein vbaProject.bin, kein macroEnabled).
 */
export function detectKind(b: Uint8Array): FileKind | null {
	if (starts(b, ascii('%PDF-'))) return 'pdf';
	if (starts(b, [0xff, 0xd8, 0xff])) return 'jpeg';
	if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
	if (starts(b, ascii('RIFF')) && starts(b, ascii('WEBP'), 8)) return 'webp';
	if (starts(b, [0x50, 0x4b, 0x03, 0x04])) {
		if (!contains(b, '[Content_Types].xml')) return null;
		if (contains(b, 'vbaProject.bin') || contains(b, 'macroEnabled')) return null;
		if (contains(b, 'word/document.xml')) return 'docx';
		if (contains(b, 'xl/workbook.xml')) return 'xlsx';
		if (contains(b, 'ppt/presentation.xml')) return 'pptx';
	}
	return null;
}

/** Dateiname für Anzeige und Download: ohne Pfad und Steuerzeichen, Endung passend zum Typ. */
export function safeFileName(raw: string, kind: FileKind): string {
	const base = (raw.split(/[\\/]/).pop() ?? '')
		.normalize('NFC')
		// eslint-disable-next-line no-control-regex -- Steuerzeichen entfernen ist der Zweck
		.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	const stem =
		base
			.replace(/\.[^.]*$/, '')
			.slice(0, 120)
			.trim() || 'Datei';
	return `${stem}.${EXTENSION[kind]}`;
}

/** Content-Disposition mit Umlauten (RFC 6266/5987). */
export function contentDisposition(name: string, inline: boolean): string {
	const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export { formatSize } from '../../format.ts';
