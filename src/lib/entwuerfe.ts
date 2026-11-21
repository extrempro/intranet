/**
 * Entwürfe für neue Neuigkeiten (auch Hub-Beiträge), Beiträge „Hinter den
 * Kulissen“ und FAQs. Nur für die eigene Person sichtbar.
 */
export const ENTWURF_ARTEN = ['news', 'kulissen', 'faq'] as const;
export type EntwurfArt = (typeof ENTWURF_ARTEN)[number];

export const ENTWURF_NAMEN: Record<EntwurfArt, string> = {
	news: 'Neuigkeit',
	kulissen: 'Hinter den Kulissen',
	faq: 'FAQ'
};

/** Seite zum Weiterschreiben (Route für resolve()) */
export const ENTWURF_SEITEN = {
	news: '/(app)/neuigkeiten/neu',
	kulissen: '/(app)/hinter-den-kulissen/neu',
	faq: '/(app)/faqs/neu'
} as const satisfies Record<EntwurfArt, string>;

/** Höchstens so viele Entwürfe je Person */
export const MAX_ENTWUERFE = 50;
/** Höchstgröße der Felder eines Entwurfs (Zeichen) */
export const MAX_ENTWURF_ZEICHEN = 400_000;
/** Unveränderte Entwürfe werden nach so vielen Tagen gelöscht */
export const ENTWURF_TAGE = 90;
