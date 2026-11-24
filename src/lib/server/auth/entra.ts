/**
 * Anmeldung über Microsoft Entra ID per OpenID Connect (Kap. 4.1).
 *
 * Konfiguration:
 * - ENTRA_CLIENT_SECRET nur als Umgebungsvariable bzw. Docker-Secret.
 * - Tenant-ID, Client-ID und Zugangsgruppe in der Einstellung „entra“
 *   (später in der Verwaltung pflegbar); bis dahin aus ENTRA_TENANT_ID,
 *   ENTRA_CLIENT_ID und ENTRA_ACCESS_GROUP_ID.
 *
 * Gruppen kommen per Microsoft Graph (transitiveMemberOf, delegiert),
 * damit verschachtelte Gruppen zählen und keine Obergrenze im Token greift.
 */
import { safeTarget } from '../../ziel.ts';
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
		accessGroupId: guidOrNull(stored.accessGroupId ?? process.env.ENTRA_ACCESS_GROUP_ID)
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
	givenName?: string | null;
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
		`${GRAPH}/me?$select=id,displayName,givenName,mail,userPrincipalName,accountEnabled`,
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

/** Nur relative Ziele innerhalb des Intranets zulassen (kein Open Redirect, siehe ziel.ts). */
export function safeReturnTo(value: string | null | undefined): string {
	return safeTarget(value, 2000);
}

// ---------------------------------------------------------------------------
// Graph mit Anwendungsberechtigungen (Client Credentials) für den nächtlichen
// Abgleich und die Prüfung der Verbindung. Nötige Berechtigungen siehe README.
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number; key: string } | null = null;

/**
 * App-Token für Graph. `mindestens`: so lange muss das Token noch gültig sein,
 * sonst wird ein neues geholt (Teams-Aktivitätsfeed verlangt 45 Minuten).
 */
export async function graphAppToken(mindestens = 60_000): Promise<string> {
	const entra = await getEntraConfig();
	if (!entra) throw new Error('Anmeldung mit Microsoft ist nicht eingerichtet');
	const key = `${entra.tenantId}|${entra.clientId}`;
	if (tokenCache && tokenCache.key === key && tokenCache.expiresAt > Date.now() + mindestens) {
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

/**
 * Teams-SSO (On-Behalf-Of): Das Token, das Teams der App gibt, gegen ein
 * Graph-Token der Person tauschen. Damit laufen Profil- und Gruppenabfrage
 * wie bei der normalen Anmeldung (delegierte Rechte User.Read und
 * GroupMember.Read.All, Administratorzustimmung nötig).
 */
export async function oboGraphToken(assertion: string): Promise<string> {
	const entra = await getEntraConfig();
	if (!entra) throw new Error('Anmeldung mit Microsoft ist nicht eingerichtet');
	const config = await getOidcConfiguration(entra);
	const res = await oidc.genericGrantRequest(
		config,
		'urn:ietf:params:oauth:grant-type:jwt-bearer',
		{
			assertion,
			requested_token_use: 'on_behalf_of',
			scope: 'https://graph.microsoft.com/.default'
		}
	);
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
export async function graphAppGet<T>(
	pathOrUrl: string,
	extraHeaders: Record<string, string> = {}
): Promise<T | null> {
	const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
	if (!url.startsWith(`${GRAPH}/`)) throw new Error('Unerwartete Graph-Adresse');
	for (let versuch = 0; ; versuch++) {
		const res = await fetch(url, {
			headers: {
				...extraHeaders,
				Authorization: `Bearer ${await graphAppToken()}`,
				Accept: 'application/json'
			},
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

// ---------------------------------------------------------------------------
// Verwaltung → Anmeldung: Werte pflegen und Verbindung prüfen
// ---------------------------------------------------------------------------

export const ENTRA_FIELDS = ['tenantId', 'clientId', 'accessGroupId'] as const;
export type EntraField = (typeof ENTRA_FIELDS)[number];
const ENV_NAMES: Record<EntraField, string> = {
	tenantId: 'ENTRA_TENANT_ID',
	clientId: 'ENTRA_CLIENT_ID',
	accessGroupId: 'ENTRA_ACCESS_GROUP_ID'
};

/** Gespeicherter Wert, Wert aus der .env und was gilt. */
export async function entraSettingsView() {
	const stored = await getSetting<StoredEntraSettings>('entra', {});
	const felder = Object.fromEntries(
		ENTRA_FIELDS.map((f) => {
			const env = guidOrNull(process.env[ENV_NAMES[f]]);
			const gespeichert = guidOrNull(stored[f]);
			return [f, { gespeichert, env, gilt: gespeichert ?? env, envName: ENV_NAMES[f] }];
		})
	) as Record<
		EntraField,
		{ gespeichert: string | null; env: string | null; gilt: string | null; envName: string }
	>;
	return {
		felder,
		secretGesetzt: Boolean(process.env.ENTRA_CLIENT_SECRET?.trim())
	};
}

/** Leere Felder fallen auf die .env zurück. Gibt Fehler je Feld zurück oder die Änderungen. */
export function parseEntraForm(form: Record<string, string>) {
	const fehler: Partial<Record<EntraField, string>> = {};
	const werte: StoredEntraSettings = {};
	for (const f of ENTRA_FIELDS) {
		const v = (form[f] ?? '').trim();
		if (!v) continue;
		if (!GUID.test(v)) fehler[f] = 'Bitte eine ID im Format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.';
		else werte[f] = v.toLowerCase();
	}
	return { fehler, werte };
}

export function clearGraphTokenCache() {
	tokenCache = null;
	cached = null;
}

/** Anwendungsberechtigungen aus dem Token (Claim „roles“), ohne Signaturprüfung – nur zur Anzeige. */
export function appRolesFromToken(token: string): string[] {
	try {
		const payload = JSON.parse(
			Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')
		);
		return Array.isArray(payload.roles)
			? payload.roles.filter((r: unknown) => typeof r === 'string')
			: [];
	} catch {
		return [];
	}
}

export interface Pruefpunkt {
	name: string;
	stufe: 'ok' | 'warnung' | 'fehler';
	text: string;
}

export const APP_PERMISSIONS: { name: string; wofuer: string; pflicht: boolean }[] = [
	{ name: 'User.Read.All', wofuer: 'nächtlicher Abgleich', pflicht: true },
	{ name: 'GroupMember.Read.All', wofuer: 'nächtlicher Abgleich, Zugangsgruppe', pflicht: true },
	{ name: 'TeamsActivity.Send', wofuer: 'Teams-Benachrichtigungen', pflicht: false }
];

export async function checkEntraConnection(): Promise<Pruefpunkt[]> {
	const punkte: Pruefpunkt[] = [];
	const entra = await getEntraConfig();
	if (!entra) {
		const v = await entraSettingsView();
		const fehlt = [
			!v.felder.tenantId.gilt && 'Tenant-ID',
			!v.felder.clientId.gilt && 'Client-ID',
			!v.secretGesetzt && 'Client-Secret (ENTRA_CLIENT_SECRET in der .env)'
		].filter(Boolean);
		return [{ name: 'Einrichtung', stufe: 'fehler', text: `Es fehlt: ${fehlt.join(', ')}.` }];
	}
	clearGraphTokenCache();
	try {
		await getOidcConfiguration(entra);
		punkte.push({ name: 'Microsoft', stufe: 'ok', text: 'Tenant gefunden, Anmeldung erreichbar.' });
	} catch {
		return [
			...punkte,
			{
				name: 'Microsoft',
				stufe: 'fehler',
				text: 'login.microsoftonline.com nicht erreichbar oder Tenant-ID falsch.'
			}
		];
	}
	let token: string;
	try {
		token = await graphAppToken();
		punkte.push({ name: 'App-Registrierung', stufe: 'ok', text: 'Client-ID und Secret gelten.' });
	} catch {
		return [
			...punkte,
			{
				name: 'App-Registrierung',
				stufe: 'fehler',
				text: 'Kein Token: Client-ID oder Secret falsch oder Secret abgelaufen.'
			}
		];
	}
	const rollen = appRolesFromToken(token);
	for (const p of APP_PERMISSIONS) {
		const da = rollen.includes(p.name);
		punkte.push({
			name: p.name,
			stufe: da ? 'ok' : p.pflicht ? 'fehler' : 'warnung',
			text: da
				? `erteilt (${p.wofuer})`
				: `fehlt (${p.wofuer}) – als Anwendungsberechtigung hinzufügen und Administratorzustimmung erteilen`
		});
	}
	for (const [name, id] of [['Zugangsgruppe', entra.accessGroupId]] as const) {
		if (!id) {
			punkte.push({
				name,
				stufe: 'fehler',
				text: 'Nicht festgelegt: Niemand kann sich mit Microsoft anmelden.'
			});
			continue;
		}
		try {
			const g = await graphAppGet<{ displayName?: string }>(`/groups/${id}?$select=id,displayName`);
			punkte.push(
				g
					? { name, stufe: 'ok', text: `„${(g.displayName ?? '').slice(0, 120)}“` }
					: { name, stufe: 'fehler', text: 'Gruppe in Entra nicht gefunden.' }
			);
		} catch (err) {
			punkte.push({
				name,
				stufe: 'warnung',
				text:
					err instanceof GraphError && err.status === 403
						? 'Nicht prüfbar: GroupMember.Read.All fehlt.'
						: 'Nicht prüfbar: Graph nicht erreichbar.'
			});
		}
	}
	return punkte;
}

/** POST gegen Graph mit Anwendungs-Token (z. B. Teams-Aktivitätsfeed). Drosselung wie bei GET. */
/**
 * Teams-Aktivitätsfeed: Das Token muss noch mindestens 45 Minuten gültig sein,
 * sonst antwortet Graph mit 412 (Precondition Failed). Etwas Puffer dazu.
 */
const FEED_MINDESTENS = 50 * 60_000;

export async function graphAppPost(path: string, body: unknown): Promise<void> {
	const url = `${GRAPH}${path}`;
	if (!path.startsWith('/')) throw new Error('Unerwartete Graph-Adresse');
	let neuesToken = false;
	for (let versuch = 0; ; versuch++) {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${await graphAppToken(FEED_MINDESTENS)}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(15_000),
			redirect: 'error'
		});
		// 412: Token zu kurz gültig. Einmal mit frisch geholtem Token wiederholen.
		if (res.status === 412 && !neuesToken) {
			neuesToken = true;
			tokenCache = null;
			continue;
		}
		if ((res.status === 429 || res.status === 503) && versuch < 3) {
			const warten = Math.min(Number(res.headers.get('Retry-After')) || 5, 60);
			await new Promise((r) => setTimeout(r, warten * 1000));
			continue;
		}
		if (!res.ok) {
			// Code aus der Antwort (ohne Inhalte), z. B. „Forbidden“
			const code = await res
				.json()
				.then((j: { error?: { code?: string } }) => j?.error?.code ?? '')
				.catch(() => '');
			throw new GraphError(
				res.status,
				`Graph antwortet mit ${res.status}${code ? ` (${code})` : ''}`
			);
		}
		return;
	}
}
