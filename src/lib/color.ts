/** Kontrast nach WCAG 2.2 (Kap. 17: mindestens 4,5:1). */
export const HEX = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
}

/** Flächen und Hintergründe aus app.css, gegen die geprüft wird. */
const HELL_FLAECHE = '#ffffff';
const DUNKEL_FLAECHE = '#1a201d';

export interface AccentCheck {
	ok: boolean;
	/** Weiße Schrift auf der Akzentfarbe (Knöpfe) */
	weissAufAkzent: number;
	/** Akzentfarbe als Schrift auf heller Fläche (Links) */
	akzentAufHell: number;
	/** Dunkelvariante als Schrift auf dunkler Fläche */
	dunkelAufDunkel: number;
}

export function checkAccent(accent: string, accentDark: string): AccentCheck {
	const weissAufAkzent = contrastRatio('#ffffff', accent);
	const akzentAufHell = contrastRatio(accent, HELL_FLAECHE);
	const dunkelAufDunkel = contrastRatio(accentDark, DUNKEL_FLAECHE);
	return {
		ok: weissAufAkzent >= 4.5 && akzentAufHell >= 4.5 && dunkelAufDunkel >= 4.5,
		weissAufAkzent,
		akzentAufHell,
		dunkelAufDunkel
	};
}

/** Standard-Seitenhintergrund aus app.css */
export const BG_DEFAULT = '#F4F6F5';
export const BG_DEFAULT_DARK = '#111614';

export interface BackgroundCheck {
	ok: boolean;
	/** Text, gedämpfter Text und Akzent auf dem hellen bzw. dunklen Hintergrund */
	hell: { text: number; gedaempft: number; akzent: number };
	dunkel: { text: number; gedaempft: number; akzent: number };
}

/**
 * Seitenhintergrund prüfen: Überschriften, gedämpfte Texte und Links liegen
 * direkt darauf und brauchen mindestens 4,5:1.
 */
export function checkBackground(
	bg: string,
	bgDark: string,
	accent: string,
	accentDark: string
): BackgroundCheck {
	const hell = {
		text: contrastRatio('#18201c', bg),
		gedaempft: contrastRatio('#525c57', bg),
		akzent: contrastRatio(accent, bg)
	};
	const dunkel = {
		text: contrastRatio('#eaefec', bgDark),
		gedaempft: contrastRatio('#a6b0ab', bgDark),
		akzent: contrastRatio(accentDark, bgDark)
	};
	const ok = [...Object.values(hell), ...Object.values(dunkel)].every((x) => x >= 4.5);
	return { ok, hell, dunkel };
}
