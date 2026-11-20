import type { RequestHandler } from '@sveltejs/kit';
import { audit } from '#lib/server/audit.ts';
import {
	deleteSessionCookie,
	invalidateSession,
	SESSION_COOKIE
} from '#lib/server/auth/session.ts';

/** Abmelden nur per POST (SvelteKit prüft die Herkunft, Schutz gegen CSRF). */
export const POST: RequestHandler = async ({ cookies, locals, getClientAddress }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(token);
	deleteSessionCookie(cookies);
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
		headers: { location: '/anmelden?abgemeldet=1', 'Clear-Site-Data': '"cache", "storage"' }
	});
};
