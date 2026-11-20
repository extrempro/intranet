import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy, passwordStrength } from '../../password';
import { decryptSecret, encryptSecret } from '../crypto';
import { generateRecoveryCodes, normalizeRecoveryCode } from './recovery';
import { remainingWaitMs, requiredWaitMs } from './throttle';
import { verifyTotpStep } from './totp';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('Passwortrichtlinie', () => {
	it('verlangt 12 bis 128 Zeichen, Leerzeichen erlaubt', () => {
		expect(checkPasswordPolicy('kurz')).toBe('too_short');
		expect(checkPasswordPolicy('ein langer satz mit leerzeichen')).toBeNull();
		expect(checkPasswordPolicy('x'.repeat(129))).toBe('too_long');
	});

	it('zählt Zeichen, nicht UTF-16-Einheiten', () => {
		expect(checkPasswordPolicy('😀'.repeat(12))).toBeNull();
		expect(checkPasswordPolicy('😀'.repeat(11))).toBe('too_short');
	});

	it('bewertet lange, vielfältige Passwörter besser', () => {
		expect(passwordStrength('aaaaaaaaaaaa')).toBe(1);
		expect(passwordStrength('Mein Hund heißt Bello 2019!')).toBe(4);
	});
});

describe('Verschlüsselung', () => {
	it('entschlüsselt, was sie verschlüsselt hat', () => {
		const secret = new Uint8Array([1, 2, 3, 250]);
		const enc = encryptSecret(secret, KEY);
		expect(enc.startsWith('v1.')).toBe(true);
		expect(decryptSecret(enc, KEY)).toEqual(secret);
	});

	it('erkennt Manipulation', () => {
		const enc = encryptSecret(new Uint8Array([1, 2, 3]), KEY).split('.');
		enc[3] = Buffer.from('xyz').toString('base64url');
		expect(() => decryptSecret(enc.join('.'), KEY)).toThrow();
	});

	it('lehnt falsche Schlüssellänge ab', () => {
		expect(() => encryptSecret(new Uint8Array([1]), Buffer.alloc(16).toString('base64'))).toThrow();
	});
});

describe('Wartezeit nach Fehlversuchen', () => {
	it('lässt 5 Versuche frei, dann wachsend bis 15 Minuten', () => {
		expect(requiredWaitMs(4)).toBe(0);
		expect(requiredWaitMs(5)).toBe(2000);
		expect(requiredWaitMs(6)).toBe(4000);
		expect(requiredWaitMs(50)).toBe(15 * 60 * 1000);
	});

	it('rechnet die Restzeit ab dem letzten Fehlversuch', () => {
		const last = new Date(10_000);
		expect(remainingWaitMs(6, last, 11_000)).toBe(3000);
		expect(remainingWaitMs(6, last, 20_000)).toBe(0);
		expect(remainingWaitMs(6, null)).toBe(0);
	});
});

describe('Wiederherstellungscodes', () => {
	it('erzeugt 10 verschiedene Codes im Format XXXX-XXXX-XXXX', () => {
		const codes = generateRecoveryCodes();
		expect(codes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	});

	it('vereinheitlicht Eingaben', () => {
		expect(normalizeRecoveryCode(' k7qm-4xpt 9hra ')).toBe('K7QM4XPT9HRA');
	});
});

describe('TOTP', () => {
	// RFC 6238, Anhang B: Schlüssel „12345678901234567890“, T = 59 s → 94287082
	const key = new TextEncoder().encode('12345678901234567890');

	it('nimmt den RFC-Testcode an und liefert den Zeitschritt', () => {
		expect(verifyTotpStep(key, '287 082', null, 59_000)).toBe(1);
	});

	it('nimmt denselben Code nicht zweimal an', () => {
		expect(verifyTotpStep(key, '287082', 1, 59_000)).toBeNull();
	});

	it('lehnt falsche Codes ab', () => {
		expect(verifyTotpStep(key, '000000', null, 59_000)).toBeNull();
		expect(verifyTotpStep(key, 'abc', null, 59_000)).toBeNull();
	});
});
