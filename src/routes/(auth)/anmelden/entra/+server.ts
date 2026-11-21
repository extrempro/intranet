import { redirect, type RequestHandler } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import {
	ENTRA_LOGIN_ORIGINS,
	ENTRA_SCOPES,
	OIDC_COOKIE,
	getEntraConfig,
	getOidcConfiguration,
	safeReturnTo
} from '#lib/server/auth/entra.ts';

/**
 * Startet die Anmeldung mit Microsoft (Authorization Code Flow mit PKCE).
 * Mit `bestaetigen=1`: erneute Anmeldung vor kritischen Verwaltungsaktionen,
 * nur für die eigene Microsoft-Sitzung im Browser (nicht in der Teams-App).
 */
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const entra = await getEntraConfig();
	if (!entra) redirect(303, '/anmelden?fehler=not_configured');
	const bestaetigen =
		url.searchParams.get('bestaetigen') === '1' &&
		locals.session?.authMethod === 'entra' &&
		!locals.teams
			? locals.session.id
			: null;

	let authUrl: URL;
	try {
		const config = await getOidcConfiguration(entra);
		const verifier = oidc.randomPKCECodeVerifier();
		const state = oidc.randomState();
		const nonce = oidc.randomNonce();

		cookies.set(
			OIDC_COOKIE,
			JSON.stringify({
				verifier,
				state,
				nonce,
				ziel: safeReturnTo(url.searchParams.get('ziel')),
				...(bestaetigen ? { bestaetigen } : {})
			}),
			{ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 }
		);

		authUrl = oidc.buildAuthorizationUrl(config, {
			redirect_uri: new URL('/anmelden/entra/callback', url.origin).href,
			scope: ENTRA_SCOPES,
			code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
			code_challenge_method: 'S256',
			state,
			nonce,
			// Bestätigen: Anmeldedaten neu eingeben (MFA nach den Entra-Richtlinien)
			...(bestaetigen && locals.person
				? { prompt: 'login', login_hint: locals.person.email }
				: { prompt: 'select_account' })
		});
	} catch (err) {
		console.error('Entra-Anmeldung konnte nicht gestartet werden:', err);
		redirect(303, '/anmelden?fehler=failed');
	}
	// Nur zur Microsoft-Anmeldung; andere externe Ziele lehnt SvelteKit ab
	redirect(303, authUrl.href, { external: ENTRA_LOGIN_ORIGINS });
};
