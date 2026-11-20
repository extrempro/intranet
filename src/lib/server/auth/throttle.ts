/**
 * Verzögerung nach Fehlversuchen (Kap. 4.2): ab 5 Fehlversuchen wachsende
 * Wartezeit (2, 4, 8 … Sekunden, höchstens 15 Minuten), keine dauerhafte Sperre.
 */
export const FREE_ATTEMPTS = 5;
const MAX_WAIT_MS = 15 * 60 * 1000;

export function requiredWaitMs(failedAttempts: number): number {
	if (failedAttempts < FREE_ATTEMPTS) return 0;
	const exp = failedAttempts - FREE_ATTEMPTS + 1;
	return Math.min(2 ** exp * 1000, MAX_WAIT_MS);
}

/** Restliche Wartezeit in ms; 0 = darf versuchen. */
export function remainingWaitMs(
	failedAttempts: number,
	lastFailedAt: Date | null,
	now = Date.now()
): number {
	if (!lastFailedAt) return 0;
	return Math.max(0, lastFailedAt.getTime() + requiredWaitMs(failedAttempts) - now);
}
