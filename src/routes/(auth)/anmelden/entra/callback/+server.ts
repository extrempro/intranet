import { redirect, type RequestHandler } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { audit } from '#lib/server/audit.ts';
import {
	fetchGroupIds,
	fetchMe,
	getEntraConfig,
	getOidcConfiguration,
	OIDC_COOKIE,
	safeReturnTo
} from '#lib/server/auth/entra.ts';
import { resolveEntraLogin } from '#lib/server/auth/entra-login.ts';
import { loadLoginContext, upsertEntraPerson } from '#lib/server/auth/entra-persist.ts';
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

	let me: Awaited<ReturnType<typeof fetchMe>>;
	let groupIds: string[];
	try {
		[me, groupIds] = await Promise.all([fetchMe(accessToken), fetchGroupIds(accessToken)]);
	} catch (err) {
		console.error('Microsoft Graph nicht erreichbar:', err);
		return deny('failed', { cause: 'graph' });
	}
	if (me.id !== oid) return deny('failed', { cause: 'oid_mismatch' });

	const context = await loadLoginContext();
	const decision = resolveEntraLogin({
		email: me.mail ?? me.userPrincipalName ?? '',
		groupIds,
		accountEnabled: me.accountEnabled !== false,
		accessGroupId: entra.accessGroupId,
		adminGroupId: entra.adminGroupId,
		domains: context.domains,
		mappings: context.mappings
	});
	if (!decision.ok) return deny(decision.reason, { oid });

	const saved = await upsertEntraPerson({
		oid,
		email: decision.email,
		displayName: me.displayName?.trim() || decision.email,
		tenantId: decision.tenantId,
		roles: decision.roles
	});
	if (!saved.ok) return deny(saved.reason, { oid });

	const session = await createSession(saved.personId, 'entra', {
		userAgent: request.headers.get('user-agent'),
		ip
	});
	setSessionCookie(cookies, session.token, session.expiresAt);
	await audit({
		category: 'security',
		action: 'login.entra.success',
		actorId: saved.personId,
		tenantId: decision.tenantId,
		details: { created: saved.created, roles: decision.roles.map((r) => r.role) },
		ip
	});

	redirect(303, flow.ziel);
};
