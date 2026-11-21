import { redirect, type RequestHandler } from '@sveltejs/kit';
import { safeTabTarget } from '#lib/teams.ts';

/**
 * Früherer Reiter der Teams-App (nur ein Link ins Intranet). Ältere
 * App-Pakete zeigen noch hierher: weiter zum Einstieg mit Anmeldung.
 */
export const GET: RequestHandler = ({ url }) => {
	const raw = url.searchParams.get('ziel');
	const ziel = safeTabTarget(raw && !raw.startsWith('{') ? raw : '/');
	redirect(303, `/teams/app?ziel=${encodeURIComponent(ziel)}`);
};
