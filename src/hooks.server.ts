import { redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { loadPrincipal } from '#lib/server/auth/access.ts';
import { deleteSessionCookie, SESSION_COOKIE, validateSession } from '#lib/server/auth/session.ts';

/** Beim Start ausstehende Migrationen einspielen (abschaltbar mit MIGRATE_ON_START=false). */
export const init: ServerInit = async () => {
	if (!process.env.ENCRYPTION_KEY) {
		console.warn('ENCRYPTION_KEY fehlt: Lokale Konten können keinen zweiten Faktor einrichten.');
	}
	if (process.env.MIGRATE_ON_START === 'false') return;
	const { runMigrations } = await import('#lib/server/db/migrate.ts');
	await runMigrations();
	const { startCleanup } = await import('#lib/server/cleanup.ts');
	startCleanup();
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
const PUBLIC_PATHS = ['/anmelden', '/einladung', '/health'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.person = null;
	event.locals.session = null;
	event.locals.principal = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = await validateSession(token);
		if (session) {
			event.locals.person = session.person;
			event.locals.session = { id: session.id, authMethod: session.authMethod };
			// Rollen und Mitgliedschaften je Anfrage frisch, damit Entzug sofort wirkt
			event.locals.principal = await loadPrincipal(session.person);
		} else {
			deleteSessionCookie(event.cookies);
		}
	}

	if (!event.locals.person && !isPublic(event.url.pathname)) {
		const ziel = event.url.pathname + event.url.search;
		redirect(303, ziel === '/' ? '/anmelden' : `/anmelden?ziel=${encodeURIComponent(ziel)}`);
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(securityHeaders)) {
		response.headers.set(name, value);
	}
	// Angemeldete Inhalte nicht in gemeinsamen Caches ablegen
	if (event.locals.person) response.headers.set('Cache-Control', 'private, no-store');
	return response;
};
