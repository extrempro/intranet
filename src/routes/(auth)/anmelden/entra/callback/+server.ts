import { redirect, type RequestHandler } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { audit } from '#lib/server/audit.ts';
import {
	getEntraConfig,
	getOidcConfiguration,
	OIDC_COOKIE,
	safeReturnTo
} from '#lib/server/auth/entra.ts';
import { finishEntraLogin } from '#lib/server/auth/entra-finish.ts';
import { createSession, setSessionCookie } from '#lib/server/auth/session.ts';

interface OidcCookie {
	verifier: string;
	state: string;
	nonce: string;
	ziel: string;
}

function readOidcCookie(raw: string | undefined): OidcCookie | null {
	if (!raw) return null;
	try {
		const v = JSON.parse(raw) as Partial<OidcCookie>;
		if (
			typeof v.verifier !== 'string' ||
			typeof v.state !== 'string' ||
			typeof v.nonce !== 'string'
		)
			return null;
		return { verifier: v.verifier, state: v.state, nonce: v.nonce, ziel: safeReturnTo(v.ziel) };
	} catch {
		return null;
	}
}

/** Rückkehr von Microsoft: Code einlösen, Person abgleichen, Sitzung anlegen. */
export const GET: RequestHandler = async ({ url, cookies, request, getClientAddress }) => {
	const ip = getClientAddress();
	const flow = readOidcCookie(cookies.get(OIDC_COOKIE));
	cookies.delete(OIDC_COOKIE, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });

	const deny = async (reason: string, details: Record<string, unknown> = {}) => {
		await audit({
			category: 'security',
			action: 'login.entra.denied',
			details: { reason, ...details },
			ip
		});
		redirect(303, `/anmelden?fehler=${encodeURIComponent(reason)}`);
	};

	const entra = await getEntraConfig();
	if (!entra) return deny('not_configured');
	if (!flow) return deny('failed', { cause: 'state_cookie_missing' });
	if (url.searchParams.has('error')) {
		// Fehlercode von Microsoft (z. B. access_denied), ohne Beschreibungstext
		return deny('failed', { cause: url.searchParams.get('error')?.slice(0, 60) });
	}

	let accessToken: string;
	let oid: string;
	try {
		const config = await getOidcConfiguration(entra);
		const tokens = await oidc.authorizationCodeGrant(config, url, {
			pkceCodeVerifier: flow.verifier,
			expectedState: flow.state,
			expectedNonce: flow.nonce,
			idTokenExpected: true
		});
		const claims = tokens.claims();
		if (!claims || claims.tid !== entra.tenantId || typeof claims.oid !== 'string') {
			return deny('failed', { cause: 'claims' });
		}
		accessToken = tokens.access_token;
		oid = claims.oid;
	} catch (err) {
		console.error('Entra-Token konnte nicht eingelöst werden:', err);
		return deny('failed', { cause: 'token' });
	}

	const saved = await finishEntraLogin(oid, accessToken);
	if (!saved.ok) return deny(saved.reason, saved.cause ? { cause: saved.cause } : { oid });

	const session = await createSession(saved.personId, 'entra', {
		userAgent: request.headers.get('user-agent'),
		ip
	});
	setSessionCookie(cookies, session.token, session.expiresAt);
	await audit({
		category: 'security',
		action: 'login.entra.success',
		actorId: saved.personId,
		tenantId: saved.tenantId,
		details: { created: saved.created, roles: saved.roles },
		ip
	});

	redirect(303, flow.ziel);
};
