/**
 * Rückmeldungen (Kap. 13): Fehler oder Idee mit Angabe der Seite.
 */
export const FEEDBACK_KINDS = [
	{ key: 'fehler', label: 'Fehler', hint: 'Etwas funktioniert nicht wie erwartet' },
	{ key: 'idee', label: 'Idee', hint: 'Vorschlag, was besser werden kann' }
] as const;

export const FEEDBACK_STATUS = {
	neu: 'Neu',
	in_arbeit: 'In Arbeit',
	erledigt: 'Erledigt',
	abgelehnt: 'Nicht umgesetzt'
} as const;
export type FeedbackStatus = keyof typeof FEEDBACK_STATUS;

export const FEEDBACK_MAX = 2000;

export function isFeedbackStatus(s: string): s is FeedbackStatus {
	return s in FEEDBACK_STATUS;
}

/** Eigener Pfad zum Zurückspringen (kein offener Redirect); sonst die Startseite. */
export function safeReturnPath(raw: string | null | undefined): string {
	const p = (raw ?? '').trim();
	if (!/^\/(?!\/)[^\s\\]*$/.test(p) || p.length > 500) return '/';
	// Nicht zurück auf das Formular selbst
	return p.startsWith('/rueckmeldung') ? '/' : p;
}

export function validateFeedback(input: { kind: string; text: string }): {
	kind?: string;
	text?: string;
} {
	const e: { kind?: string; text?: string } = {};
	if (!FEEDBACK_KINDS.some((k) => k.key === input.kind)) e.kind = 'Bitte wähle Fehler oder Idee.';
	const t = input.text.trim();
	if (t.length < 5) e.text = 'Beschreib es bitte mit ein paar Worten.';
	else if (t.length > FEEDBACK_MAX) e.text = `Höchstens ${FEEDBACK_MAX} Zeichen.`;
	return e;
}

// ---------------------------------------------------------------------------
// Fehler: technische Angaben und Bildschirmfoto (nur System-Admins lesen sie)
// ---------------------------------------------------------------------------

/** Technische Angaben zu einer Fehlermeldung; alles aus dem Browser, gekürzt geprüft. */
export interface FeedbackTechnik {
	/** Version des Intranets im Browser (kann älter sein als auf dem Server) */
	version: string | null;
	/** Fenstergröße, z. B. „1280 × 800“ */
	fenster: string | null;
	/** Browser (User-Agent) */
	browser: string | null;
	/** In der Teams-App geöffnet */
	teams: boolean;
	/** Letzte Fehlermeldungen des Browsers auf dieser Seite (höchstens fünf) */
	fehler: string[];
}

/** So groß darf das verkleinerte Bildschirmfoto höchstens sein (Browser zielt auf 150 KB). */
export const SCREENSHOT_MAX = 300 * 1024;
/** Tage nach Abschluss einer Fehlermeldung, bis das Bildschirmfoto gelöscht wird */
export const SCREENSHOT_TAGE = 30;
export const BROWSERFEHLER_MAX = 5;

/** Ohne Steuerzeichen, gekürzt; leer → null */
function zeile(v: unknown, max: number): string | null {
	if (typeof v !== 'string') return null;
	// Steuerzeichen (Zeilenumbrüche, Tabs …) durch Leerzeichen ersetzen
	const ohne = Array.from(v, (c) => {
		const n = c.charCodeAt(0);
		return n < 32 || n === 127 ? ' ' : c;
	}).join('');
	const t = ohne.replace(/ {2,}/g, ' ').trim().slice(0, max);
	return t || null;
}

/** Angaben aus dem Formular (JSON) prüfen; Unbekanntes fällt weg. */
export function technikAusEingabe(roh: string, browser: string | null): FeedbackTechnik {
	let j: Record<string, unknown> = {};
	try {
		const x = JSON.parse(roh.slice(0, 4000));
		if (x && typeof x === 'object' && !Array.isArray(x)) j = x as Record<string, unknown>;
	} catch {
		// leer lassen
	}
	const version = zeile(j.version, 20);
	const fenster = zeile(j.fenster, 20);
	return {
		version: version && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version) ? version : null,
		fenster: fenster && /^\d{1,5} × \d{1,5}$/.test(fenster) ? fenster : null,
		browser: zeile(browser, 400),
		teams: j.teams === true,
		fehler: (Array.isArray(j.fehler) ? j.fehler : [])
			.slice(-BROWSERFEHLER_MAX)
			.map((f) => zeile(f, 280))
			.filter((f): f is string => Boolean(f))
	};
}
