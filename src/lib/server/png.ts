/** Einfache PNG-Symbole (RGBA) ohne Zusatzpaket, für das Teams-App-Paket. */
import { deflateSync } from 'node:zlib';
import { crc32 } from './zip.ts';

function chunk(type: string, data: Buffer): Buffer {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}

/** pixel(x, y) → [r, g, b, a] */
export function png(
	size: number,
	pixel: (x: number, y: number) => [number, number, number, number]
) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0; // Filter: keiner
		for (let x = 0; x < size; x++) {
			const o = y * (size * 4 + 1) + 1 + x * 4;
			const [r, g, b, a] = pixel(x, y);
			raw[o] = r;
			raw[o + 1] = g;
			raw[o + 2] = b;
			raw[o + 3] = a;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // Bittiefe
	ihdr[9] = 6; // RGBA
	return new Uint8Array(
		Buffer.concat([
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			chunk('IHDR', ihdr),
			chunk('IDAT', deflateSync(raw)),
			chunk('IEND', Buffer.alloc(0))
		])
	);
}

/**
 * Symbol „Seite mit Zeilen“: drei Balken in einem Rahmen. f = Anteil der
 * Kantenlänge, damit es in 192 und 32 Pixeln gleich aussieht.
 */
export function pageIcon(
	size: number,
	fg: [number, number, number, number],
	bg: [number, number, number, number]
) {
	const s = (v: number) => Math.round(v * size);
	const rects = [
		// Rahmen
		[0.22, 0.16, 0.78, 0.2],
		[0.22, 0.8, 0.78, 0.84],
		[0.22, 0.16, 0.26, 0.84],
		[0.74, 0.16, 0.78, 0.84],
		// Zeilen
		[0.34, 0.32, 0.66, 0.38],
		[0.34, 0.47, 0.66, 0.53],
		[0.34, 0.62, 0.56, 0.68]
	].map(([x1, y1, x2, y2]) => [s(x1), s(y1), s(x2), s(y2)]);
	return png(size, (x, y) =>
		rects.some(([x1, y1, x2, y2]) => x >= x1 && x < x2 && y >= y1 && y < y2) ? fg : bg
	);
}
