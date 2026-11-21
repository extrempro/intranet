/**
 * Bilder im Text (Editor): erlaubte Größen und Ausrichtungen als Klassen am
 * <img>, Adresse nur /dateien/<ID>. Gilt für Editor, Server und Anzeige.
 */
export const BILD_GROESSEN = ['klein', 'mittel', 'voll'] as const;
export const BILD_AUSRICHTUNGEN = ['links', 'rechts'] as const;
export type BildGroesse = (typeof BILD_GROESSEN)[number];
export type BildAusrichtung = (typeof BILD_AUSRICHTUNGEN)[number];

/** Höchstens so viele Bilder je Text */
export const MAX_BILDER_IM_TEXT = 20;
/** Höchstgröße je Bild (animierte WebP werden nicht verkleinert) */
export const MAX_TEXTBILD_BYTES = 5 * 1024 * 1024;

export const BILD_KLASSEN = [
	...BILD_GROESSEN.map((g) => `bild-${g}`),
	...BILD_AUSRICHTUNGEN.map((a) => `bild-${a}`),
	// Animiertes WebP: startet angehalten, mit Knopf zum Abspielen (WCAG 2.2.2)
	'bild-animiert'
];

const SRC = /<img\b[^>]*?\bsrc="\/dateien\/([0-9a-f-]{36})"/gi;

/** Datei-IDs der Bilder im Text, in Reihenfolge, ohne Doppelte */
export function bildIdsImText(html: string): string[] {
	return [...new Set([...html.matchAll(SRC)].map((m) => m[1].toLowerCase()))];
}

/** Hat jedes Bild eine Beschreibung (alt)? */
export function alleBilderBeschrieben(html: string): boolean {
	for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
		const alt = /\balt="([^"]*)"/i.exec(m[0])?.[1] ?? '';
		if (!alt.trim()) return false;
	}
	return true;
}
