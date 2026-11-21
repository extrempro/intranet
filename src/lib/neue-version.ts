/**
 * Hinweis „Neu in Version …“ nach einem Update: einmal je Person und Version,
 * abschaltbar unter Konto. Beim ersten Besuch wird nur gemerkt, nichts gezeigt.
 */
export interface Neuerungsstand {
	/** Zuletzt gesehene Version; null = noch nie gemerkt */
	gesehen: string | null;
	/** Hinweis eingeschaltet (Konto → Weitere Einstellungen) */
	an: boolean;
}

export interface Neuerungsentscheid {
	/** Aktuelle Version als gesehen speichern */
	merken: boolean;
	/** Hinweis zeigen */
	zeigen: boolean;
}

export function neuerungsHinweis(
	stand: Neuerungsstand,
	aktuell: string,
	pfad: string
): Neuerungsentscheid {
	if (stand.gesehen === aktuell) return { merken: false, zeigen: false };
	// Wer „Neu im Intranet“ selbst öffnet, hat es gesehen
	if (pfad === '/neu-im-intranet') return { merken: true, zeigen: false };
	return { merken: true, zeigen: stand.an && stand.gesehen !== null };
}
