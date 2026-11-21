import { describe, expect, it } from 'vitest';
import { istAnimiertesWebp, stripWebp, WebpError } from './webp.ts';

function chunk(typ: string, daten: number[]) {
	const l = daten.length;
	return [...typ]
		.map((c) => c.charCodeAt(0))
		.concat([l & 255, (l >> 8) & 255, 0, 0], daten, l & 1 ? [0] : []);
}
function webp(...chunks: number[][]) {
	const body = [0x57, 0x45, 0x42, 0x50, ...chunks.flat()];
	const l = body.length;
	return new Uint8Array([0x52, 0x49, 0x46, 0x46, l & 255, (l >> 8) & 255, 0, 0, ...body]);
}
const text = (b: Uint8Array) => String.fromCharCode(...b);

describe('WebP ohne Metadaten', () => {
	const vp8x = chunk('VP8X', [0x02 | 0x08 | 0x04, 0, 0, 0, 9, 0, 0, 9, 0, 0]);
	const anim = chunk('ANIM', [0, 0, 0, 0, 0, 0]);
	const exif = chunk(
		'EXIF',
		[...'GPS-Daten'].map((c) => c.charCodeAt(0))
	);
	const xmp = chunk('XMP ', [1, 2, 3]);
	const frame = chunk('ANMF', [1, 2, 3, 4, 5]);

	it('entfernt EXIF und XMP, behält Animation', () => {
		const ein = webp(vp8x, anim, exif, xmp, frame);
		expect(istAnimiertesWebp(ein)).toBe(true);
		const aus = stripWebp(ein);
		expect(text(aus)).not.toContain('GPS-Daten');
		expect(text(aus)).not.toContain('XMP ');
		expect(text(aus)).toContain('ANMF');
		expect(aus[20] & 0x0c).toBe(0);
		expect(istAnimiertesWebp(aus)).toBe(true);
		// RIFF-Länge passt
		expect(aus[4] | (aus[5] << 8)).toBe(aus.length - 8);
	});
	it('lehnt andere Dateien ab', () => {
		expect(() => stripWebp(new Uint8Array([1, 2, 3]))).toThrow(WebpError);
	});
});
