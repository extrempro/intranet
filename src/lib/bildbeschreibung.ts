/**
 * Bildbeschreibungen (Alternativtexte, WCAG 1.1.1) für hochgeladene Bilder.
 * Im Formular je Bild ein Feld „beschreibung_<Datei-ID>“; leer = allgemeiner
 * Text („Foto 1 von 3 zu …“).
 */
export const BESCHREIBUNG_MAX = 250;
export const BILD_ARTEN = ['jpeg', 'png', 'webp'];

export const istBild = (kind: string | null | undefined) => BILD_ARTEN.includes(kind ?? '');

export const beschreibungFeld = (id: string) => `beschreibung_${id}`;

/** Alternativtext: eigene Beschreibung oder allgemeiner Text */
export function bildAlt(beschreibung: string | null | undefined, allgemein: string): string {
	const b = beschreibung?.trim();
	return b ? b : allgemein;
}
