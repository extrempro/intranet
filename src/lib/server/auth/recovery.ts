import { randomInt } from 'node:crypto';

/** Ohne leicht verwechselbare Zeichen (0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_COUNT = 10;

/** Ein Code wie „K7QM-4XPT-9HRA“ (12 Zeichen, ≈ 59 Bit). */
export function generateRecoveryCode(): string {
	const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
	return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
	return Array.from({ length: count }, generateRecoveryCode);
}

/** Eingabe vereinheitlichen: Groß, ohne Leerzeichen und Bindestriche. */
export function normalizeRecoveryCode(input: string): string {
	return input.toUpperCase().replace(/[\s-]/g, '');
}
