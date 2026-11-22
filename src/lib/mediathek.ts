/**
 * Mediathek (Kap. 8.15): Regeln, die Oberfläche und Server teilen.
 */
export const MAX_VIDEO_BYTES = 4 * 1024 ** 3;
/** Größe eines Teils beim Hochladen (unter BODY_SIZE_LIMIT und Proxy-Grenzen) */
export const TEIL_BYTES = 16 * 1024 * 1024;
export const MAX_TITEL = 150;
export const MAX_BESCHREIBUNG = 3000;
export const MAX_KAPITEL = 100;

export interface Kapitel {
	s: number;
	t: string;
}

export function zeitText(sek: number): string {
	const h = Math.floor(sek / 3600);
	const m = Math.floor((sek % 3600) / 60);
	const s = Math.floor(sek % 60);
	const mm = h ? String(m).padStart(2, '0') : String(m);
	return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** „m:ss“ oder „h:mm:ss“ in Sekunden, sonst NaN */
export function zeitLesen(txt: string): number {
	const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(txt.trim());
	if (!m || Number(m[3]) > 59 || (m[1] && Number(m[2]) > 59)) return Number.NaN;
	return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Fehler je Kapitel (leer = in Ordnung) */
export function kapitelFehler(liste: { s: number; t: string }[], dauer: number): string[] {
	return liste.map((k, i) => {
		if (!Number.isFinite(k.s)) return 'Zeit als m:ss eingeben';
		if (i === 0 && k.s !== 0) return 'Das erste Kapitel beginnt bei 0:00';
		if (i > 0 && Number.isFinite(liste[i - 1].s) && k.s <= liste[i - 1].s)
			return 'Muss nach dem vorigen Kapitel beginnen';
		if (dauer > 0 && k.s >= dauer) return 'Liegt nach dem Ende des Videos';
		if (!k.t.trim()) return 'Titel fehlt';
		if (k.t.length > 120) return 'Höchstens 120 Zeichen';
		return '';
	});
}

/** Liste als Text („03:20 Titel“ je Zeile) lesen; Zeilen ohne Zeit fallen weg */
export function kapitelAusText(text: string): { s: number; t: string }[] {
	return text
		.split(/\r?\n/)
		.map((z) => /^\s*((?:\d+:)?\d{1,2}:\d{2})\s*[-–:]?\s*(.*)$/.exec(z))
		.filter((m): m is RegExpExecArray => m !== null)
		.slice(0, MAX_KAPITEL)
		.map((m) => ({ s: zeitLesen(m[1]), t: m[2].trim() }));
}

export const STATUS_TEXT: Record<string, string> = {
	hochladen: 'Wird hochgeladen',
	warten: 'Wartet auf die Umwandlung',
	umwandeln: 'Wird umgewandelt',
	fehler: 'Fehler',
	entwurf: 'Entwurf',
	veroeffentlicht: 'Veröffentlicht'
};
