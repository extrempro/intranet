/**
 * Rückmeldungen (Kap. 13): Fehler oder Idee mit Angabe der Seite.
 */
export const FEEDBACK_KINDS = [
	{ key: 'fehler', label: 'Fehler', hint: 'Etwas funktioniert nicht wie erwartet' },
	{ key: 'idee', label: 'Idee', hint: 'Vorschlag, was besser werden kann' }
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['key'];

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
