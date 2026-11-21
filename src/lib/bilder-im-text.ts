/**
 * Bilder im Text (Editor): erlaubte Größen und Ausrichtungen als Klassen am
 * <img>, Adresse nur /dateien/<ID>. Gilt für Editor, Server und Anzeige.
 */
export const BILD_AUSRICHTUNGEN = ['links', 'rechts'] as const;
export type BildAusrichtung = (typeof BILD_AUSRICHTUNGEN)[number];

/** Breite in Prozent der Textbreite, in 5er-Schritten (Klasse bild-b<n>) */
export const BILD_BREITE_MIN = 10;
export const BILD_BREITE_SCHRITT = 5;
export const BILD_BREITEN = Array.from(
	{ length: (100 - BILD_BREITE_MIN) / BILD_BREITE_SCHRITT + 1 },
	(_, i) => BILD_BREITE_MIN + i * BILD_BREITE_SCHRITT
);
/** Schnellwahl im Editor */
export const BILD_VORGABEN = [
	{ breite: 30, name: 'Klein' },
	{ breite: 50, name: 'Mittel' },
	{ breite: 100, name: 'Volle Breite' }
] as const;
/** Frühere Größen (bis 0.15) */
const ALTE_GROESSEN: Record<string, number> = { klein: 35, mittel: 50, voll: 100 };

/** Breite auf erlaubten Wert runden und begrenzen */
export function bildBreite(prozent: number): number {
	const n = Math.round(prozent / BILD_BREITE_SCHRITT) * BILD_BREITE_SCHRITT;
	return Math.min(100, Math.max(BILD_BREITE_MIN, Number.isFinite(n) ? n : 100));
}

/** Breite aus den Klassen eines Bildes (auch frühere klein/mittel/voll) */
export function breiteAusKlassen(klassen: Iterable<string>): number {
	for (const k of klassen) {
		const m = /^bild-b(\d+)$/.exec(k);
		if (m) return bildBreite(Number(m[1]));
		const alt = ALTE_GROESSEN[k.replace(/^bild-/, '')];
		if (alt) return alt;
	}
	return 100;
}

/** Höchstens so viele Bilder je Text */
export const MAX_BILDER_IM_TEXT = 20;
/** Höchstgröße je Bild (animierte WebP werden nicht verkleinert) */
export const MAX_TEXTBILD_BYTES = 5 * 1024 * 1024;

export const BILD_KLASSEN = [
	...BILD_BREITEN.map((b) => `bild-b${b}`),
	...Object.keys(ALTE_GROESSEN).map((g) => `bild-${g}`),
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
