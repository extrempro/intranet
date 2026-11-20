/**
 * JPEG ohne Metadaten: Für Profilfotos (Kap. 8.13) bleiben nur die Teile,
 * die zum Anzeigen nötig sind. EXIF (mit GPS, Kamera, Vorschaubild), XMP,
 * ICC, IPTC und Kommentare fallen weg. Ohne Bildbibliothek, rein in TypeScript.
 */

export class JpegError extends Error {}

/** Segmente, die bleiben: JFIF (APP0), Tabellen, Bildkopf, Huffman, Restart. */
function keep(marker: number): boolean {
	return (
		marker === 0xe0 || // APP0 (JFIF)
		marker === 0xdb || // DQT
		marker === 0xc4 || // DHT
		marker === 0xdd || // DRI
		(marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
	);
}

export interface CleanJpeg {
	data: Uint8Array;
	width: number;
	height: number;
}

export function stripJpeg(input: Uint8Array): CleanJpeg {
	const b = input;
	if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new JpegError('Kein JPEG.');
	const out: Uint8Array[] = [Uint8Array.of(0xff, 0xd8)];
	let i = 2;
	let width = 0;
	let height = 0;
	while (i < b.length) {
		if (b[i] !== 0xff) throw new JpegError('Beschädigtes JPEG.');
		// Füllbytes überspringen
		while (b[i] === 0xff && i < b.length) i++;
		const marker = b[i++];
		if (marker === undefined) throw new JpegError('Beschädigtes JPEG.');
		if (marker === 0xd9) break; // EOI ohne Bilddaten
		if (marker >= 0xd0 && marker <= 0xd7) throw new JpegError('Beschädigtes JPEG.');
		if (i + 2 > b.length) throw new JpegError('Beschädigtes JPEG.');
		const len = (b[i] << 8) | b[i + 1];
		if (len < 2 || i + len > b.length) throw new JpegError('Beschädigtes JPEG.');
		const segment = b.subarray(i - 2, i + len);
		if (marker === 0xda) {
			// Start of Scan: Rest der Datei sind Bilddaten bis EOI
			if (!width || !height) throw new JpegError('Beschädigtes JPEG.');
			out.push(b.subarray(i - 2));
			const total = out.reduce((n, x) => n + x.length, 0);
			const data = new Uint8Array(total);
			let o = 0;
			for (const x of out) {
				data.set(x, o);
				o += x.length;
			}
			return { data, width, height };
		}
		if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
			if (len < 7) throw new JpegError('Beschädigtes JPEG.');
			height = (b[i + 3] << 8) | b[i + 4];
			width = (b[i + 5] << 8) | b[i + 6];
		}
		if (keep(marker)) out.push(segment);
		i += len;
	}
	throw new JpegError('Das JPEG enthält kein Bild.');
}
