import { redirect, type RequestHandler } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import {
	ENTRA_SCOPES,
	OIDC_COOKIE,
	getEntraConfig,
	getOidcConfiguration,
	safeReturnTo
} from '#lib/server/auth/entra.ts';

/** Startet die Anmeldung mit Microsoft (Authorization Code Flow mit PKCE). */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const entra = await getEntraConfig();
	if (!entra) redirect(303, '/anmelden?fehler=not_configured');

	let authUrl: URL;
	try {
		const config = await getOidcConfiguration(entra);
		const verifier = oidc.randomPKCECodeVerifier();
		const state = oidc.randomState();
		const nonce = oidc.randomNonce();

		cookies.set(
			OIDC_COOKIE,
			JSON.stringify({ verifier, state, nonce, ziel: safeReturnTo(url.searchParams.get('ziel')) }),
			{ path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 }
		);

		authUrl = oidc.buildAuthorizationUrl(config, {
			redirect_uri: new URL('/anmelden/entra/callback', url.origin).href,
			scope: ENTRA_SCOPES,
			code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
			code_challenge_method: 'S256',
			state,
			nonce,
			prompt: 'select_account'
		});
	} catch (err) {
		console.error('Entra-Anmeldung konnte nicht gestartet werden:', err);
		redirect(303, '/anmelden?fehler=failed');
	}
	redirect(303, authUrl.href);
};
