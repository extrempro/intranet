/**
 * Bilder für den Text vorbereiten (Editor): im Browser auf höchstens 1600 px
 * verkleinern und neu speichern (ohne Metadaten wie Ort oder Kamera), wenn
 * möglich als WebP, sonst als JPEG. Dann hochladen wie Anhänge (/dateien).
 */
import { MAX_TEXTBILD_BYTES } from './bilder-im-text.ts';

const MAX_KANTE = 1600;
const ERLAUBT = ['image/jpeg', 'image/png', 'image/webp'];

export function istTextbild(datei: File | Blob): boolean {
	return ERLAUBT.includes(datei.type);
}

async function alsBlob(c: HTMLCanvasElement, typ: string, guete: number) {
	return new Promise<Blob | null>((ok) => c.toBlob(ok, typ, guete));
}

/** Animiertes WebP? (VP8X-Kopf mit Animations-Kennzeichen) */
async function istAnimiert(datei: Blob): Promise<boolean> {
	if (datei.type !== 'image/webp') return false;
	const b = new Uint8Array(await datei.slice(0, 32).arrayBuffer());
	const t = (i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
	return (
		b.length >= 21 && t(0) === 'RIFF' && t(8) === 'WEBP' && t(12) === 'VP8X' && (b[20] & 2) !== 0
	);
}

/**
 * Stehende Bilder werden verkleinert und neu gespeichert. Animierte WebP
 * bleiben im Original (sonst ginge die Animation verloren), höchstens 5 MB;
 * Metadaten entfernt dann der Server.
 */
export async function bildVorbereiten(datei: Blob): Promise<{ blob: Blob; animiert: boolean }> {
	if (!istTextbild(datei)) throw new Error('Bitte ein Bild als JPG, PNG oder WebP wählen.');
	if (await istAnimiert(datei)) {
		if (datei.size > MAX_TEXTBILD_BYTES)
			throw new Error('Animierte Bilder dürfen höchstens 5 MB groß sein.');
		return { blob: datei, animiert: true };
	}
	return { blob: await verkleinern(datei), animiert: false };
}

async function verkleinern(datei: Blob): Promise<Blob> {
	let bild: ImageBitmap;
	try {
		bild = await createImageBitmap(datei);
	} catch {
		throw new Error('Dieses Bild lässt sich nicht lesen.');
	}
	try {
		const f = Math.min(1, MAX_KANTE / bild.width, MAX_KANTE / bild.height);
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.round(bild.width * f));
		c.height = Math.max(1, Math.round(bild.height * f));
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('Das Bild konnte nicht umgerechnet werden.');
		ctx.drawImage(bild, 0, 0, c.width, c.height);
		const webp = await alsBlob(c, 'image/webp', 0.82);
		if (webp?.type === 'image/webp') return webp;
		// Ohne WebP (ältere Browser): JPEG mit weißem Hintergrund
		ctx.globalCompositeOperation = 'destination-over';
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, c.width, c.height);
		const jpeg = await alsBlob(c, 'image/jpeg', 0.85);
		if (!jpeg) throw new Error('Das Bild konnte nicht umgerechnet werden.');
		return jpeg;
	} finally {
		bild.close();
	}
}

/** Hochladen; liefert die Adresse für das Bild im Text. */
export async function bildHochladen(blob: Blob): Promise<string> {
	const form = new FormData();
	form.set('datei', blob, blob.type === 'image/webp' ? 'bild.webp' : 'bild.jpg');
	const r = await fetch('/dateien', { method: 'POST', body: form });
	const j = (await r.json().catch(() => ({}))) as { id?: string; fehler?: string };
	if (!r.ok || !j.id) throw new Error(j.fehler ?? 'Das Bild konnte nicht hochgeladen werden.');
	return `/dateien/${j.id}`;
}
