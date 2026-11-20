/**
 * Anmeldung über Microsoft Entra ID per OpenID Connect (Kap. 4.1).
 *
 * Konfiguration:
 * - ENTRA_CLIENT_SECRET nur als Umgebungsvariable bzw. Docker-Secret.
 * - Tenant-ID, Client-ID und Zugangsgruppe in der Einstellung „entra“
 *   (später in der Verwaltung pflegbar); bis dahin aus ENTRA_TENANT_ID,
 *   ENTRA_CLIENT_ID und ENTRA_ACCESS_GROUP_ID.
 * - ENTRA_ADMIN_GROUP_ID: Mitglieder werden System-Admin (Erstbefüllung).
 *
 * Gruppen kommen per Microsoft Graph (transitiveMemberOf, delegiert),
 * damit verschachtelte Gruppen zählen und keine Obergrenze im Token greift.
 */
import * as oidc from 'openid-client';
import { getSetting } from '../settings.ts';

/** Kurzlebiges Cookie mit state, nonce und PKCE-Verifier während der Anmeldung. */
export const OIDC_COOKIE = '__Host-intranet-oidc';

/**
 * Einziges externes Ziel für Weiterleitungen (SvelteKit 3 verlangt eine
 * ausdrückliche Freigabe, siehe redirect(..., { external })).
 */
export const ENTRA_LOGIN_ORIGINS = ['https://login.microsoftonline.com'];

export const ENTRA_SCOPES = 'openid profile email User.Read GroupMember.Read.All';
const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface EntraConfig {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	accessGroupId: string | null;
	adminGroupId: string | null;
}

interface StoredEntraSettings {
	tenantId?: string;
	clientId?: string;
	accessGroupId?: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function guidOrNull(value: string | undefined | null): string | null {
	const v = value?.trim();
	return v && GUID.test(v) ? v : null;
}

/** Gibt null zurück, wenn die Anmeldung mit Microsoft nicht vollständig eingerichtet ist. */
export async function getEntraConfig(): Promise<EntraConfig | null> {
	const stored = await getSetting<StoredEntraSettings>('entra', {});
	const tenantId = guidOrNull(stored.tenantId ?? process.env.ENTRA_TENANT_ID);
	const clientId = guidOrNull(stored.clientId ?? process.env.ENTRA_CLIENT_ID);
	const clientSecret = process.env.ENTRA_CLIENT_SECRET?.trim();
	if (!tenantId || !clientId || !clientSecret) return null;
	return {
		tenantId,
		clientId,
		clientSecret,
		accessGroupId: guidOrNull(stored.accessGroupId ?? process.env.ENTRA_ACCESS_GROUP_ID),
		adminGroupId: guidOrNull(process.env.ENTRA_ADMIN_GROUP_ID)
	};
}

let cached: { key: string; config: oidc.Configuration } | null = null;

/** OIDC-Konfiguration per Discovery, je Tenant/Client zwischengespeichert. */
export async function getOidcConfiguration(entra: EntraConfig): Promise<oidc.Configuration> {
	const key = `${entra.tenantId}|${entra.clientId}|${entra.clientSecret.length}`;
	if (cached?.key === key) return cached.config;
	const config = await oidc.discovery(
		new URL(`https://login.microsoftonline.com/${entra.tenantId}/v2.0`),
		entra.clientId,
		undefined,
		oidc.ClientSecretPost(entra.clientSecret),
		{ timeout: 10 }
	);
	cached = { key, config };
	return config;
}

export interface GraphMe {
	id: string;
	displayName: string | null;
	mail: string | null;
	userPrincipalName: string;
	accountEnabled?: boolean;
}

async function graphGet<T>(url: string, accessToken: string): Promise<T> {
	if (!url.startsWith(`${GRAPH}/`)) throw new Error('Unerwartete Graph-Adresse');
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
		signal: AbortSignal.timeout(10_000),
		redirect: 'error'
	});
	if (!res.ok) throw new Error(`Graph antwortet mit ${res.status}`);
	return (await res.json()) as T;
}

export function fetchMe(accessToken: string): Promise<GraphMe> {
	return graphGet<GraphMe>(
		`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName,accountEnabled`,
		accessToken
	);
}

/** Alle Gruppen-IDs der Person, auch über verschachtelte Gruppen. */
export async function fetchGroupIds(accessToken: string): Promise<string[]> {
	const ids: string[] = [];
	let url: string | undefined =
		`${GRAPH}/me/transitiveMemberOf/microsoft.graph.group?$select=id&$top=999`;
	for (let page = 0; url && page < 50; page++) {
		const body: { value: { id: string }[]; '@odata.nextLink'?: string } = await graphGet(
			url,
			accessToken
		);
		ids.push(...body.value.map((g) => g.id));
		url = body['@odata.nextLink'];
	}
	return ids;
}

/** Nur relative Ziele innerhalb des Intranets zulassen (kein Open Redirect). */
export function safeReturnTo(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return '/';
	}
	return value;
}

// ---------------------------------------------------------------------------
// Graph mit Anwendungsberechtigungen (Client Credentials): E-Mail-Versand und
// nächtlicher Abgleich. Nötige Berechtigungen siehe README.
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number; key: string } | null = null;

export async function graphAppToken(): Promise<string> {
	const entra = await getEntraConfig();
	if (!entra) throw new Error('Anmeldung mit Microsoft ist nicht eingerichtet');
	const key = `${entra.tenantId}|${entra.clientId}`;
	if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now() + 60_000) {
		return tokenCache.token;
	}
	const config = await getOidcConfiguration(entra);
	const res = await oidc.clientCredentialsGrant(config, {
		scope: 'https://graph.microsoft.com/.default'
	});
	tokenCache = {
		token: res.access_token,
		expiresAt: Date.now() + (res.expires_in ?? 3000) * 1000,
		key
	};
	return res.access_token;
}

export class GraphError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

/**
 * GET gegen Graph mit Anwendungs-Token. 404 → null. Bei Drosselung (429/503)
 * bis zu dreimal nach Retry-After erneut.
 */
export async function graphAppGet<T>(pathOrUrl: string): Promise<T | null> {
	const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
	if (!url.startsWith(`${GRAPH}/`)) throw new Error('Unerwartete Graph-Adresse');
	for (let versuch = 0; ; versuch++) {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${await graphAppToken()}`, Accept: 'application/json' },
			signal: AbortSignal.timeout(15_000),
			redirect: 'error'
		});
		if (res.status === 404) return null;
		if ((res.status === 429 || res.status === 503) && versuch < 3) {
			const warten = Math.min(Number(res.headers.get('Retry-After')) || 5, 60);
			await new Promise((r) => setTimeout(r, warten * 1000));
			continue;
		}
		if (!res.ok) throw new GraphError(res.status, `Graph antwortet mit ${res.status}`);
		return (await res.json()) as T;
	}
}
