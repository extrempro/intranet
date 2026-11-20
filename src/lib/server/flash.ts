/**
 * Kurze Meldung über eine Weiterleitung hinweg (z. B. „Danke für deine
 * Rückmeldung“ auf der Ausgangsseite). Nur feste Texte, kein HTML.
 */
import type { Cookies } from '@sveltejs/kit';

const NAME = 'intranet-meldung';
const TEXTE = {
	rueckmeldung: 'Danke für deine Rückmeldung! Den Stand siehst du unter „Meine Meldungen“.'
} as const;

export type FlashKey = keyof typeof TEXTE;

export function setFlash(cookies: Cookies, key: FlashKey) {
	cookies.set(NAME, key, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 });
}

export function takeFlash(cookies: Cookies): string | null {
	const key = cookies.get(NAME);
	if (!key) return null;
	cookies.delete(NAME, { path: '/' });
	return key in TEXTE ? TEXTE[key as FlashKey] : null;
}
