/**
 * Passwortrichtlinie (Kap. 4.2), auf Server und im Browser nutzbar.
 * Mindestens 12 (einstellbar 12/14/16), höchstens 128 Zeichen, Leerzeichen
 * erlaubt, keine Pflicht zu Zeichenarten. Die Prüfung gegen bekannte
 * Passwörter (HIBP) läuft nur auf dem Server.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_MIN_OPTIONS = [12, 14, 16] as const;
export type PasswordMin = (typeof PASSWORD_MIN_OPTIONS)[number];

/** Gültigkeit des Links „Passwort vergessen“ in Minuten (Kap. 4.2). */
export const RESET_MINUTES_OPTIONS = [15, 30, 60] as const;
export type ResetMinutes = (typeof RESET_MINUTES_OPTIONS)[number];

export interface PasswordPolicy {
	minLength: PasswordMin;
	resetMinutes: ResetMinutes;
}
export const DEFAULT_POLICY: PasswordPolicy = { minLength: 12, resetMinutes: 30 };

/** Gespeicherte Werte prüfen; Unbekanntes fällt auf den Standard zurück. */
export function normalizePolicy(raw: unknown): PasswordPolicy {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	return {
		minLength: PASSWORD_MIN_OPTIONS.includes(r.minLength as PasswordMin)
			? (r.minLength as PasswordMin)
			: DEFAULT_POLICY.minLength,
		resetMinutes: RESET_MINUTES_OPTIONS.includes(r.resetMinutes as ResetMinutes)
			? (r.resetMinutes as ResetMinutes)
			: DEFAULT_POLICY.resetMinutes
	};
}

/** Länge in Zeichen (nicht UTF-16-Einheiten), nach Unicode-Normalisierung. */
export function passwordLength(password: string): number {
	return [...password.normalize('NFC')].length;
}

export type PasswordProblem = 'too_short' | 'too_long';

export function checkPasswordPolicy(
	password: string,
	min: number = PASSWORD_MIN
): PasswordProblem | null {
	const len = passwordLength(password);
	if (len < min) return 'too_short';
	if (len > PASSWORD_MAX) return 'too_long';
	return null;
}

export function passwordMessage(
	problem: PasswordProblem | 'pwned' | 'mismatch',
	min: number = PASSWORD_MIN
): string {
	return problem === 'too_short'
		? `Dein Passwort braucht mindestens ${min} Zeichen. Tipp: Nimm einen Satz, den du dir gut merken kannst.`
		: PASSWORD_MESSAGES[problem];
}

export const PASSWORD_MESSAGES: Record<PasswordProblem | 'pwned' | 'mismatch', string> = {
	too_short: `Dein Passwort braucht mindestens ${PASSWORD_MIN} Zeichen. Tipp: Nimm einen Satz, den du dir gut merken kannst.`,
	too_long: `Dein Passwort darf höchstens ${PASSWORD_MAX} Zeichen haben.`,
	pwned:
		'Dieses Passwort ist aus Datenlecks bekannt und deshalb unsicher. Wähle bitte ein anderes.',
	mismatch: 'Die beiden Passwörter stimmen nicht überein.'
};

/**
 * Grobe Stärkeanzeige 0–4, nur als Hilfe (keine Regel).
 * Länge zählt am meisten, Vielfalt der Zeichen etwas.
 */
export function passwordStrength(password: string, min: number = PASSWORD_MIN): 0 | 1 | 2 | 3 | 4 {
	const len = passwordLength(password);
	if (len < min) return 0;
	const classes = [/[a-zäöüß]/, /[A-ZÄÖÜ]/, /\d/, /[^\p{L}\d]/u].filter((r) =>
		r.test(password)
	).length;
	const unique = new Set(password).size;
	let score = len >= 20 ? 3 : len >= 16 ? 2 : 1;
	if (classes >= 3) score++;
	if (unique < 6) score = 1;
	return Math.min(score, 4) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABELS = ['zu kurz', 'schwach', 'mittel', 'gut', 'sehr gut'] as const;
