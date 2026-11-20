import { generateHOTP, createTOTPKeyURI } from '@oslojs/otp';
import { randomBytes } from 'node:crypto';

const PERIOD = 30;
const DIGITS = 6;
/** Ein Zeitschritt vor und zurück, für ungenaue Uhren. */
const WINDOW = 1;

export function generateTotpKey(): Uint8Array {
	return new Uint8Array(randomBytes(20));
}

export function totpUri(key: Uint8Array, accountName: string): string {
	return createTOTPKeyURI('Intranet', accountName, key, PERIOD, DIGITS);
}

/**
 * Prüft einen Code und gibt den Zeitschritt zurück, damit derselbe Code
 * nicht zweimal angenommen wird (lastStep). null = ungültig oder schon benutzt.
 */
export function verifyTotpStep(
	key: Uint8Array,
	code: string,
	lastStep: number | null,
	now = Date.now()
): number | null {
	const clean = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(clean)) return null;
	const current = Math.floor(now / 1000 / PERIOD);
	for (let step = current - WINDOW; step <= current + WINDOW; step++) {
		if (lastStep !== null && step <= lastStep) continue;
		if (timingSafeEqualStr(generateHOTP(key, BigInt(step), DIGITS), clean)) return step;
	}
	return null;
}

function timingSafeEqualStr(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Schlüssel zum Abtippen, in Vierergruppen. */
export function formatKeyForDisplay(base32: string): string {
	return (
		base32
			.replace(/=+$/, '')
			.match(/.{1,4}/g)
			?.join(' ') ?? base32
	);
}
