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
