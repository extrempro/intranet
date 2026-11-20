import { describe, expect, it } from 'vitest';
import {
	checkPasswordPolicy,
	DEFAULT_POLICY,
	normalizePolicy,
	passwordMessage,
	passwordStrength
} from './password.ts';

describe('Passwortrichtlinie', () => {
	it('Mindestlänge ist einstellbar', () => {
		const pw = 'vierzehn zeich';
		expect(checkPasswordPolicy(pw)).toBeNull();
		expect(checkPasswordPolicy(pw, 14)).toBeNull();
		expect(checkPasswordPolicy(pw, 16)).toBe('too_short');
		expect(passwordStrength(pw, 16)).toBe(0);
		expect(passwordMessage('too_short', 16)).toContain('16 Zeichen');
	});
	it('gespeicherte Werte nur aus den Optionen', () => {
		expect(normalizePolicy(null)).toEqual(DEFAULT_POLICY);
		expect(normalizePolicy({ minLength: 16, resetMinutes: 15 })).toEqual({
			minLength: 16,
			resetMinutes: 15
		});
		expect(normalizePolicy({ minLength: 8, resetMinutes: 600 })).toEqual(DEFAULT_POLICY);
	});
});
