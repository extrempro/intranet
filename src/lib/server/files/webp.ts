/**
 * WebP ohne Metadaten: entfernt EXIF- und XMP-Chunks (Kamera, Ort, Programm)
 * und löscht die zugehörigen Kennzeichen im VP8X-Kopf. Bilddaten und
 * Animation bleiben unverändert. Ohne Bildbibliothek, rein in TypeScript.
 */
export class WebpError extends Error {}

const ascii = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

export function istAnimiertesWebp(b: Uint8Array): boolean {
	if (b.length < 30 || ascii(b, 0) !== 'RIFF' || ascii(b, 8) !== 'WEBP') return false;
	return ascii(b, 12) === 'VP8X' && (b[20] & 0x02) !== 0;
}

export function stripWebp(input: Uint8Array): Uint8Array {
	const b = input;
	if (b.length < 20 || ascii(b, 0) !== 'RIFF' || ascii(b, 8) !== 'WEBP')
		throw new WebpError('Kein WebP.');
	const teile: Uint8Array[] = [];
	let i = 12;
	while (i + 8 <= b.length) {
		const typ = ascii(b, i);
		const laenge = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
		if (laenge < 0) throw new WebpError('Beschädigtes WebP.');
		const ende = i + 8 + laenge + (laenge & 1);
		if (ende > b.length + 1) throw new WebpError('Beschädigtes WebP.');
		if (typ !== 'EXIF' && typ !== 'XMP ') {
			const teil = b.slice(i, Math.min(ende, b.length));
			// VP8X: Kennzeichen für EXIF (0x08) und XMP (0x04) löschen
			if (typ === 'VP8X') teil[8] &= ~0x0c;
			teile.push(teil);
		}
		i = ende;
	}
	const groesse = 4 + teile.reduce((n, t) => n + t.length, 0);
	const out = new Uint8Array(8 + groesse);
	out.set([0x52, 0x49, 0x46, 0x46], 0);
	out[4] = groesse & 0xff;
	out[5] = (groesse >> 8) & 0xff;
	out[6] = (groesse >> 16) & 0xff;
	out[7] = (groesse >> 24) & 0xff;
	out.set([0x57, 0x45, 0x42, 0x50], 8);
	let o = 12;
	for (const t of teile) {
		out.set(t, o);
		o += t.length;
	}
	return out;
}
