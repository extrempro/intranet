/**
 * Bilder des Mandanten: Logo hell/dunkel und App-Symbol (Favicon, Startbildschirm).
 * Der Browser rechnet jedes Bild in PNG um; hier wird nur geprüft und
 * gespeichert. Abruf öffentlich über /marke/<Mandant>/<Datei>.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db/index.ts';
import { tenantAssets } from './db/schema.ts';

export type MarkenArt = (typeof tenantAssets.$inferSelect)['art'];

export class MarkeError extends Error {}

const MAX_BYTES = 1_000_000;

/** Breite und Höhe aus dem PNG-Kopf; null, wenn es kein PNG ist. */
export function pngSize(b: Uint8Array): { width: number; height: number } | null {
	const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (b.length < 33 || !sig.every((v, i) => b[i] === v)) return null;
	// erster Block muss IHDR sein
	if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== 'IHDR') return null;
	const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
	return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** Prüft Format und Maße je Art. */
export function checkImage(art: MarkenArt, b: Uint8Array) {
	if (b.length === 0) throw new MarkeError('Bitte wähle ein Bild.');
	if (b.length > MAX_BYTES) throw new MarkeError('Das Bild ist zu groß (höchstens 1 MB).');
	const size = pngSize(b);
	if (!size) throw new MarkeError('Das Bild konnte nicht gelesen werden.');
	if (art.startsWith('symbol_')) {
		const n = Number(art.slice(7));
		if (size.width !== n || size.height !== n)
			throw new MarkeError('Das App-Symbol hat nicht die erwartete Größe.');
	} else if (size.width < 16 || size.height < 16 || size.width > 1200 || size.height > 400) {
		throw new MarkeError('Das Logo muss zwischen 16 und 1200 × 400 Pixel groß sein.');
	}
	return size;
}

export async function saveImages(tenantId: string, bilder: { art: MarkenArt; data: Uint8Array }[]) {
	const geprueft = bilder.map((x) => ({ ...x, ...checkImage(x.art, x.data) }));
	await db.transaction(async (tx) => {
		for (const x of geprueft) {
			const values = {
				tenantId,
				art: x.art,
				data: new Uint8Array(x.data),
				width: x.width,
				height: x.height,
				updatedAt: new Date()
			};
			await tx
				.insert(tenantAssets)
				.values(values)
				.onConflictDoUpdate({
					target: [tenantAssets.tenantId, tenantAssets.art],
					set: { data: values.data, width: x.width, height: x.height, updatedAt: values.updatedAt }
				});
		}
	});
}

export async function deleteImages(tenantId: string, arten: MarkenArt[]) {
	if (arten.length === 0) return;
	await db
		.delete(tenantAssets)
		.where(and(eq(tenantAssets.tenantId, tenantId), inArray(tenantAssets.art, arten)));
}

export async function readImage(tenantId: string, art: MarkenArt) {
	const [row] = await db
		.select({ data: tenantAssets.data, updatedAt: tenantAssets.updatedAt })
		.from(tenantAssets)
		.where(and(eq(tenantAssets.tenantId, tenantId), eq(tenantAssets.art, art)));
	return row ?? null;
}

/** Welche Bilder es gibt, mit Stand (für Cache-Busting in Adressen). */
export async function imageVersions(tenantId: string): Promise<Partial<Record<MarkenArt, number>>> {
	const rows = await db
		.select({ art: tenantAssets.art, updatedAt: tenantAssets.updatedAt })
		.from(tenantAssets)
		.where(eq(tenantAssets.tenantId, tenantId));
	return Object.fromEntries(rows.map((r) => [r.art, r.updatedAt.getTime()]));
}
