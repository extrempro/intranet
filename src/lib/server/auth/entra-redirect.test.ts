import { isRedirect, redirect } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { ENTRA_LOGIN_ORIGINS } from './entra';

/** Regression: SvelteKit 3 verbietet externe Weiterleitungen ohne Freigabe (Fehler 500). */
describe('Weiterleitung zur Microsoft-Anmeldung', () => {
	const authorize =
		'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/oauth2/v2.0/authorize?client_id=x';

	function versuch(ziel: string) {
		try {
			redirect(303, ziel, { external: ENTRA_LOGIN_ORIGINS });
		} catch (e) {
			return e;
		}
	}

	it('erlaubt login.microsoftonline.com', () => {
		const e = versuch(authorize);
		expect(isRedirect(e)).toBe(true);
	});

	it('lehnt andere Ziele ab', () => {
		expect(isRedirect(versuch('https://evil.example/authorize'))).toBe(false);
		expect(isRedirect(versuch('http://login.microsoftonline.com/x'))).toBe(false);
	});
});
