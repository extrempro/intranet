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

/** Zwei Hex-Farben mischen (Anteil von b: 0…1). */
export function mixHex(a: string, b: string, anteil: number): string {
	const kanal = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
	return (
		'#' +
		[1, 3, 5]
			.map((i) => Math.round(kanal(a, i) * (1 - anteil) + kanal(b, i) * anteil))
			.map((v) => v.toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase()
	);
}

// ---------------------------------------------------------------------------
// Oberflächenfarben je Darstellung (Mandant)
// ---------------------------------------------------------------------------

export type Modus = 'hell' | 'dunkel';
export const FARB_FELDER = ['knopf', 'hintergrund', 'flaeche', 'rahmen', 'text', 'grau'] as const;
export type FarbFeld = (typeof FARB_FELDER)[number];
/** Eigene Werte je Feld; fehlend oder leer = Standard bzw. abgeleitet */
export type EigeneFarben = Partial<Record<FarbFeld, string>>;
export type UiFarben = Partial<Record<Modus, EigeneFarben>>;

export const FARB_NAMEN: Record<FarbFeld, string> = {
	knopf: 'Knöpfe',
	hintergrund: 'Hintergrund',
	flaeche: 'Flächen',
	rahmen: 'Rahmen und Linien',
	text: 'Text',
	grau: 'Grauer Text'
};

export interface Palette {
	akzent: string;
	knopf: string;
	hintergrund: string;
	flaeche: string;
	rahmen: string;
	text: string;
	grau: string;
}

const STANDARD: Record<Modus, Omit<Palette, 'akzent' | 'knopf'>> = {
	hell: {
		hintergrund: '#F4F6F5',
		flaeche: '#FFFFFF',
		rahmen: '#D9DFDB',
		text: '#18201C',
		grau: '#525C57'
	},
	dunkel: {
		hintergrund: '#111614',
		flaeche: '#1A201D',
		rahmen: '#2F3733',
		text: '#EAEFEC',
		grau: '#A6B0AB'
	}
};

const gesetzt = (v: string | undefined) => (v && HEX.test(v) ? v.toUpperCase() : null);

/**
 * Wirksame Farben einer Darstellung. Ohne eigene Fläche/Rahmen werden sie im
 * Dunkeln aus einem eigenen Hintergrund abgeleitet; Knöpfe nutzen ohne
 * Eintrag die helle Akzentfarbe (weiße Schrift).
 */
export function palette(
	modus: Modus,
	akzent: string,
	akzentHell: string,
	eigen: EigeneFarben = {}
): Palette {
	const s = STANDARD[modus];
	const hintergrund = gesetzt(eigen.hintergrund) ?? s.hintergrund;
	const eigenerHg = Boolean(gesetzt(eigen.hintergrund));
	return {
		akzent: akzent.toUpperCase(),
		knopf: gesetzt(eigen.knopf) ?? akzentHell.toUpperCase(),
		hintergrund,
		flaeche:
			gesetzt(eigen.flaeche) ??
			(modus === 'dunkel' && eigenerHg ? mixHex(hintergrund, '#ffffff', 0.08) : s.flaeche),
		rahmen:
			gesetzt(eigen.rahmen) ??
			(eigenerHg
				? mixHex(
						hintergrund,
						modus === 'dunkel' ? '#ffffff' : '#18201c',
						modus === 'dunkel' ? 0.18 : 0.12
					)
				: s.rahmen),
		text: gesetzt(eigen.text) ?? s.text,
		grau: gesetzt(eigen.grau) ?? s.grau
	};
}

export interface PalettenPruefung {
	ok: boolean;
	/** Kleinster Kontrast auf Hintergrund und Fläche */
	text: number;
	grau: number;
	akzent: number;
	/** Weiße Schrift auf Knöpfen */
	knopf: number;
}

export function pruefePalette(p: Palette): PalettenPruefung {
	const auf = (fg: string) =>
		Math.min(contrastRatio(fg, p.hintergrund), contrastRatio(fg, p.flaeche));
	const r = {
		text: auf(p.text),
		grau: auf(p.grau),
		akzent: auf(p.akzent),
		knopf: contrastRatio('#ffffff', p.knopf)
	};
	return { ok: Object.values(r).every((x) => x >= 4.5), ...r };
}

/** Eingaben bereinigen: nur gültige Hex-Werte, Großschreibung. */
export function normalizeUiFarben(v: unknown): UiFarben {
	const out: UiFarben = {};
	if (!v || typeof v !== 'object') return out;
	for (const m of ['hell', 'dunkel'] as const) {
		const quelle = (v as Record<string, unknown>)[m];
		if (!quelle || typeof quelle !== 'object') continue;
		const ziel: EigeneFarben = {};
		for (const f of FARB_FELDER) {
			const x = (quelle as Record<string, unknown>)[f];
			if (typeof x === 'string' && HEX.test(x)) ziel[f] = x.toUpperCase();
		}
		if (Object.keys(ziel).length) out[m] = ziel;
	}
	return out;
}
