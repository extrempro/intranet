import { describe, expect, it } from 'vitest';
import { JpegError, stripJpeg } from './jpeg.ts';

const seg = (marker: number, payload: number[]) => [
	0xff,
	marker,
	(payload.length + 2) >> 8,
	(payload.length + 2) & 0xff,
	...payload
];

function jpeg(extra: number[][] = []) {
	return Uint8Array.from([
		0xff,
		0xd8,
		...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]),
		...extra.flat(),
		...seg(0xdb, [0, 1, 2]),
		// SOF0: Präzision 8, Höhe 512, Breite 512, 1 Komponente
		...seg(0xc0, [8, 2, 0, 2, 0, 1, 1, 0x11, 0]),
		...seg(0xc4, [0, 1]),
		...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
		0x12,
		0x34,
		0xff,
		0xd9
	]);
}

describe('stripJpeg', () => {
	it('entfernt EXIF und Kommentare, behält das Bild', () => {
		const exif = seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 9, 9, 9]);
		const com = seg(0xfe, [0x47, 0x50, 0x53]);
		const withMeta = jpeg([exif, com]);
		const clean = stripJpeg(withMeta);
		expect(clean.width).toBe(512);
		expect(clean.height).toBe(512);
		expect(Array.from(clean.data)).toEqual(Array.from(jpeg()));
		expect(Buffer.from(clean.data).includes(Buffer.from('Exif'))).toBe(false);
	});

	it('lehnt Nicht-JPEGs und kaputte Dateien ab', () => {
		expect(() => stripJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow(JpegError);
		expect(() => stripJpeg(jpeg().subarray(0, 12))).toThrow(JpegError);
	});
});
