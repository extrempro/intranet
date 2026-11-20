import { describe, expect, it } from 'vitest';
import { checkImage, MarkeError, pngSize } from './marke.ts';

/** Minimaler PNG-Kopf mit IHDR (für die Prüfung reichen Signatur und Maße). */
function kopf(w: number, h: number): Uint8Array {
	const b = new Uint8Array(40);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	b.set([0, 0, 0, 13], 8);
	b.set(
		[...'IHDR'].map((c) => c.charCodeAt(0)),
		12
	);
	const v = new DataView(b.buffer);
	v.setUint32(16, w);
	v.setUint32(20, h);
	return b;
}

describe('Mandantenbilder', () => {
	it('liest Breite und Höhe aus dem PNG-Kopf', () => {
		expect(pngSize(kopf(600, 160))).toEqual({ width: 600, height: 160 });
	});

	it('lehnt andere Formate ab', () => {
		expect(pngSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)]))).toBeNull();
		expect(() =>
			checkImage('logo_hell', new TextEncoder().encode('<svg></svg>'.padEnd(40)))
		).toThrow(MarkeError);
	});

	it('prüft die Maße je Art', () => {
		expect(checkImage('logo_hell', kopf(600, 160))).toEqual({ width: 600, height: 160 });
		expect(() => checkImage('logo_dunkel', kopf(2000, 160))).toThrow(MarkeError);
		expect(checkImage('symbol_192', kopf(192, 192))).toEqual({ width: 192, height: 192 });
		expect(() => checkImage('symbol_192', kopf(512, 512))).toThrow(MarkeError);
	});
});
