import { describe, expect, it } from 'vitest';
import { decryptFile, encryptFile } from './crypto';
import { contentDisposition, detectKind, formatSize, safeFileName } from './types';

const b = (...parts: (string | number[])[]) =>
	new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p)));

describe('detectKind', () => {
	it('erkennt PDF und Bilder am Inhalt', () => {
		expect(detectKind(b('%PDF-1.7\n'))).toBe('pdf');
		expect(detectKind(b([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
		expect(detectKind(b([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
		expect(detectKind(b('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
	});

	it('erkennt Office ohne Makros', () => {
		const zip = (inner: string) => b([0x50, 0x4b, 0x03, 0x04], `[Content_Types].xml ${inner}`);
		expect(detectKind(zip('word/document.xml'))).toBe('docx');
		expect(detectKind(zip('xl/workbook.xml'))).toBe('xlsx');
		expect(detectKind(zip('ppt/presentation.xml'))).toBe('pptx');
		expect(detectKind(zip('word/document.xml word/vbaProject.bin'))).toBeNull();
		expect(
			detectKind(zip('application/vnd.ms-word.document.macroEnabled word/document.xml'))
		).toBeNull();
	});

	it('lehnt anderes ab, auch mit passender Endung', () => {
		expect(detectKind(b('<html><script>'))).toBeNull();
		expect(detectKind(b('<svg xmlns='))).toBeNull();
		expect(detectKind(b([0x50, 0x4b, 0x03, 0x04], 'irgendein.zip'))).toBeNull();
		expect(detectKind(b('MZ'))).toBeNull();
	});
});

describe('Dateinamen', () => {
	it('entfernt Pfade und Steuerzeichen und setzt die Endung nach Typ', () => {
		expect(safeFileName('C:\\temp\\Plan KW 48.PDF', 'pdf')).toBe('Plan KW 48.pdf');
		expect(safeFileName('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
		expect(safeFileName('rechnung.pdf.exe', 'pdf')).toBe('rechnung.pdf.pdf');
		expect(safeFileName('a"b<c>.png', 'png')).toBe('abc.png');
		expect(safeFileName('', 'jpeg')).toBe('Datei.jpg');
	});

	it('kodiert Umlaute im Download-Kopf', () => {
		expect(contentDisposition('Übersicht März.pdf', true)).toBe(
			`inline; filename="_bersicht M_rz.pdf"; filename*=UTF-8''%C3%9Cbersicht%20M%C3%A4rz.pdf`
		);
	});

	it('zeigt Größen lesbar', () => {
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(240 * 1024)).toBe('240 KB');
		expect(formatSize(3.5 * 1024 * 1024)).toBe('3,5 MB');
	});
});

describe('Verschlüsselung je Datei', () => {
	const key = Buffer.alloc(32, 9);
	it('entschlüsselt nur mit passender Datei-ID', () => {
		const enc = encryptFile(Buffer.from('Inhalt'), key, 'id-1');
		expect(decryptFile(enc, key, 'id-1').toString()).toBe('Inhalt');
		expect(() => decryptFile(enc, key, 'id-2')).toThrow();
	});
	it('erkennt Manipulation', () => {
		const enc = encryptFile(Buffer.from('Inhalt'), key, 'id-1');
		enc[enc.length - 1] ^= 1;
		expect(() => decryptFile(enc, key, 'id-1')).toThrow();
	});
	it('lehnt eine abgeschnittene Datei ab', () => {
		const enc = encryptFile(Buffer.from('Inhalt'), key, 'id-1');
		expect(() => decryptFile(enc.subarray(0, 20), key, 'id-1')).toThrow();
	});
});
