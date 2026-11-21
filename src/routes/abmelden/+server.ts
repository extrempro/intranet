import type { RequestHandler } from '@sveltejs/kit';
import { audit } from '#lib/server/audit.ts';
import {
	deleteSessionCookie,
	deleteTeamsSessionCookie,
	invalidateSession,
	SESSION_COOKIE,
	TEAMS_SESSION_COOKIE
} from '#lib/server/auth/session.ts';

/** Abmelden nur per POST (SvelteKit prüft die Herkunft, Schutz gegen CSRF). */
export const POST: RequestHandler = async ({ cookies, locals, getClientAddress }) => {
	const token = cookies.get(SESSION_COOKIE) ?? cookies.get(TEAMS_SESSION_COOKIE);
	if (token) await invalidateSession(token);
	deleteSessionCookie(cookies);
	deleteTeamsSessionCookie(cookies);
	if (locals.person) {
		await audit({
			category: 'security',
			action: 'logout',
			actorId: locals.person.id,
			tenantId: locals.person.tenantId,
			ip: getClientAddress()
		});
	}
	// Offline gespeicherte Pläne, Service Worker und Push-Abo dieses Browsers löschen (Kap. 15)
	return new Response(null, {
		status: 303,
		headers: {
			// In Teams nicht auf die Anmeldeseite, sondern zurück zum Einstieg der App
			location: locals.teams ? '/teams/app?abgemeldet=1' : '/anmelden?abgemeldet=1',
			'Clear-Site-Data': '"cache", "storage"'
		}
	});
};
