/**
 * Infokästen im Text (Editor): Arten, Beschriftung und erlaubte Klassen.
 * Gespeichert als <div class="kasten kasten-<art>">, bereinigt in server/html.ts.
 */
export const KASTEN_ARTEN = ['info', 'hinweis', 'warnung'] as const;
export type KastenArt = (typeof KASTEN_ARTEN)[number];

export const KASTEN_NAMEN: Record<KastenArt, string> = {
	info: 'Info',
	hinweis: 'Hinweis',
	warnung: 'Warnung'
};

export const KASTEN_KLASSEN = ['kasten', ...KASTEN_ARTEN.map((a) => `kasten-${a}`)];
