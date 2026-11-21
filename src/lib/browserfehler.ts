/**
 * Letzte Fehlermeldungen des Browsers (höchstens fünf), nur im Speicher.
 * Gehen bei einer Fehlermeldung mit, damit sich das Problem nachstellen lässt.
 */
import { BROWSERFEHLER_MAX } from './feedback.ts';

const letzte: string[] = [];
let aktiv = false;

function merke(text: string) {
	const zeit = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' });
	letzte.push(`${zeit} ${text}`.slice(0, 280));
	if (letzte.length > BROWSERFEHLER_MAX) letzte.shift();
}

/** Einmal beim Start der App aufrufen. */
export function browserfehlerMerken() {
	if (aktiv || typeof window === 'undefined') return;
	aktiv = true;
	addEventListener('error', (e) => merke(e.message || 'Fehler ohne Text'));
	addEventListener('unhandledrejection', (e) => {
		const r = e.reason as { message?: unknown } | undefined;
		merke(String(r?.message ?? e.reason));
	});
}

export function letzteBrowserfehler(): string[] {
	return [...letzte];
}
