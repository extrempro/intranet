import { brandingFor, headLinks, mainBranding } from '#lib/server/tenant-branding.ts';
import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { loadPrincipal } from '#lib/server/auth/access.ts';
import { getPreferences } from '#lib/server/preferences.ts';
import {
	deleteSessionCookie,
	deleteTeamsSessionCookie,
	SESSION_COOKIE,
	TEAMS_SESSION_COOKIE,
	validateSession
} from '#lib/server/auth/session.ts';

/** Beim Start ausstehende Migrationen einspielen (abschaltbar mit MIGRATE_ON_START=false). */
export const init: ServerInit = async () => {
	if (!process.env.ENCRYPTION_KEY) {
		console.warn('ENCRYPTION_KEY fehlt: Lokale Konten können keinen zweiten Faktor einrichten.');
	}
	if (process.env.MIGRATE_ON_START === 'false') return;
	const { runMigrations } = await import('#lib/server/db/migrate.ts');
	await runMigrations();
	const { ensureInitialTenant } = await import('#lib/server/bootstrap.ts');
	await ensureInitialTenant();
	const { startCleanup } = await import('#lib/server/cleanup.ts');
	startCleanup();
	const { startNotifier } = await import('#lib/server/notify.ts');
	startNotifier();
	const { startEntraSync } = await import('#lib/server/auth/entra-sync.ts');
	startEntraSync();
};

/**
 * Sicherheits-Header für jede Antwort.
 * Die Content Security Policy setzt SvelteKit selbst (vite.config.ts).
 */
const securityHeaders: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Resource-Policy': 'same-origin',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/** Ohne Anmeldung erreichbar. Alles andere nur mit gültiger Sitzung. */
/** /ical: persönliches Kalender-Abo, geschützt durch den geheimen Link (Kap. 8.8). */
/** /teams/tab: Tab der Teams-App, zeigt nur einen Link (Kap. 11.1). */
/** /teams/test: vorübergehender Test-Tab (SSO, Cookies), zeigt keine Inhalte. */
/** /teams/app: Einstieg der Teams-App (Anmeldung per SSO), /teams/anmelden: Token-Tausch. */
const PUBLIC_PATHS = [
	'/anmelden',
	'/einladung',
	'/health',
	'/ical',
	'/teams/tab',
	'/teams/test',
	'/teams/app',
	'/teams/anmelden',
	'/teams/teams.js',
	'/marke'
];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Betreiber-Konten sehen nur ihre eigene Oberfläche (Kap. 4.3). */
const OPERATOR_PATHS = ['/betreiber', '/abmelden'];

function operatorMay(pathname: string, method: string): boolean {
	if (OPERATOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
	// Speisepläne des eigenen Standorts (Prüfung in /dateien/[id])
	return method === 'GET' && /^\/dateien\/[0-9a-f-]{36}$/i.test(pathname);
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.person = null;
	event.locals.session = null;
	event.locals.principal = null;
	event.locals.theme = 'auto';
	event.locals.teams = false;

	// Im Browser das normale Cookie, in der Teams-App das partitionierte Teams-Cookie
	const browserToken = event.cookies.get(SESSION_COOKIE);
	const teamsToken = browserToken ? undefined : event.cookies.get(TEAMS_SESSION_COOKIE);
	const token = browserToken ?? teamsToken;
	if (token) {
		const session = await validateSession(token);
		if (session) {
			event.locals.person = session.person;
			event.locals.session = { id: session.id, authMethod: session.authMethod };
			// Rollen und Mitgliedschaften je Anfrage frisch, damit Entzug sofort wirkt
			const [principal, prefs] = await Promise.all([
				loadPrincipal(session.person),
				getPreferences(session.person.id)
			]);
			event.locals.principal = principal;
			event.locals.theme = prefs.theme;
			event.locals.teams = Boolean(teamsToken);
		} else if (teamsToken) {
			deleteTeamsSessionCookie(event.cookies);
		} else {
			deleteSessionCookie(event.cookies);
		}
	}

	if (!event.locals.person && !isPublic(event.url.pathname)) {
		const ziel = event.url.pathname + event.url.search;
		// Eingebettet (Teams-App): neu per SSO anmelden statt Anmeldeseite im Rahmen
		if (event.request.headers.get('sec-fetch-dest') === 'iframe')
			redirect(303, `/teams/app?ziel=${encodeURIComponent(ziel)}`);
		redirect(303, ziel === '/' ? '/anmelden' : `/anmelden?ziel=${encodeURIComponent(ziel)}`);
	}

	if (
		event.locals.principal?.operatorLocationId &&
		!isPublic(event.url.pathname) &&
		!operatorMay(event.url.pathname, event.request.method)
	) {
		redirect(303, '/betreiber');
	}

	const theme = event.locals.theme;
	// Favicon und App-Symbol des Mandanten (vor der Anmeldung: Hauptmandant)
	let symbole: string | null = null;
	const response = await resolve(event, {
		// Darstellung schon im HTML setzen, damit nichts flackert
		transformPageChunk: async ({ html }) => {
			if (!html.includes('%intranet.')) return html;
			symbole ??= headLinks(
				event.locals.person ? await brandingFor(event.locals.person.tenantId) : await mainBranding()
			);
			return html.replace('%intranet.theme%', theme).replace('%intranet.symbole%', symbole);
		}
	});
	for (const [name, value] of Object.entries(securityHeaders)) {
		response.headers.set(name, value);
	}
	// Angemeldete Inhalte nicht in gemeinsamen Caches ablegen
	// (Mandantenbilder unter /marke sind öffentlich und dürfen zwischengespeichert werden)
	if (event.locals.person && !event.url.pathname.startsWith('/marke/'))
		response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
