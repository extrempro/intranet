/**
 * Begrenzung von Anfragen (Kap. 16, ASVS V2.2.1/V11.1.4): gleitendes Fenster
 * im Speicher des Anwendungsprozesses. Reicht für eine Instanz; nach einem
 * Neustart beginnt die Zählung neu.
 */
export interface Limiter {
	/** true = erlaubt (und gezählt), false = zu viele */
	hit(key: string, now?: number): boolean;
	/** Sekunden bis zur nächsten erlaubten Anfrage (0 = jetzt) */
	retryAfter(key: string, now?: number): number;
}

const MAX_KEYS = 20_000;

export function limiter(max: number, windowMs: number): Limiter {
	const hits = new Map<string, number[]>();
	const fresh = (key: string, now: number) => {
		const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
		if (list.length) hits.set(key, list);
		else hits.delete(key);
		return list;
	};
	return {
		hit(key, now = Date.now()) {
			const list = fresh(key, now);
			if (list.length >= max) return false;
			list.push(now);
			hits.set(key, list);
			// Speicher begrenzen: älteste Schlüssel zuerst entfernen
			if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value as string);
			return true;
		},
		retryAfter(key, now = Date.now()) {
			const list = fresh(key, now);
			if (list.length < max) return 0;
			return Math.ceil((list[0] + windowMs - now) / 1000);
		}
	};
}

/** Anmeldeversuche je IP (zusätzlich zur Verzögerung je Konto) */
export const loginLimit = limiter(30, 10 * 60_000);
/** Zweiter Faktor je IP */
export const secondFactorLimit = limiter(30, 10 * 60_000);
/** Hochladen je Person */
export const uploadLimit = limiter(60, 60 * 60_000);
/** Nachrichten (Gespräche, Anfragen zu Anzeigen) je Person */
export const messageLimit = limiter(30, 10 * 60_000);
/** Rückmeldungen je Person */
export const feedbackLimit = limiter(10, 60 * 60_000);
/** Entwürfe speichern (automatisch alle paar Sekunden beim Schreiben) */
export const draftLimit = limiter(600, 60 * 60_000);

export function wait(seconds: number): string {
	return seconds > 90 ? `${Math.ceil(seconds / 60)} Minuten` : `${seconds} Sekunden`;
}
