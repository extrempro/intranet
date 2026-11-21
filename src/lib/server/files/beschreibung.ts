/** Bildbeschreibungen aus Formularen lesen und an den Dateien speichern */
import { and, eq, inArray } from 'drizzle-orm';
import { BESCHREIBUNG_MAX, BILD_ARTEN } from '../../bildbeschreibung.ts';
import { db } from '../db/index.ts';
import { files } from '../db/schema.ts';

type Tx = Pick<typeof db, 'update'>;

const FELD = /^beschreibung_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Datei-ID → Beschreibung (gekürzt, ohne Zeilenumbrüche); leer = Beschreibung entfernen */
export function beschreibungenAusForm(form: FormData): Map<string, string> {
	const m = new Map<string, string>();
	for (const [k, v] of form) {
		const id = FELD.exec(k)?.[1];
		if (!id || typeof v !== 'string') continue;
		m.set(id.toLowerCase(), v.replace(/\s+/g, ' ').trim().slice(0, BESCHREIBUNG_MAX));
	}
	return m;
}

/**
 * Speichert Beschreibungen nur für die übergebenen (bereits geprüften)
 * Datei-IDs und nur für Bilder.
 */
export async function beschreibungenSpeichern(
	tx: Tx,
	ids: string[],
	beschreibungen: Map<string, string> | undefined
) {
	if (!beschreibungen?.size) return;
	for (const id of ids) {
		const b = beschreibungen.get(id.toLowerCase());
		if (b === undefined) continue;
		await tx
			.update(files)
			.set({ description: b || null })
			.where(and(eq(files.id, id), inArray(files.kind, BILD_ARTEN)));
	}
}

/** Für das erneute Anzeigen nach Fehlern: eingegebene Beschreibungen übernehmen */
export function mitBeschreibungen<T extends { id: string; description?: string | null }>(
	liste: T[],
	beschreibungen: Map<string, string>
): T[] {
	return liste.map((a) => {
		const b = beschreibungen.get(a.id.toLowerCase());
		return b === undefined ? a : { ...a, description: b };
	});
}
