import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { personAusWahl, teamPersonenSuchen } from '#lib/server/personen-suche.ts';
import { UnitError } from '#lib/server/units.ts';

/**
 * Personensuche für das Team einer Einheit (Verwaltung, Abteilung, GF,
 * Stabsstelle, Hub): Personen im Intranet und Mitglieder der Zugangsgruppe
 * aus Entra. Nur für die Verwaltung und die Pflege-Rolle der Einheit.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const p = requirePrincipal(locals);
	try {
		const treffer = await teamPersonenSuchen(
			p,
			params.id ?? '',
			url.searchParams.get('q') ?? '',
			url.searchParams.get('entra') === '0' ? { suchen: async () => [] } : undefined
		);
		return json(treffer, { headers: { 'Cache-Control': 'private, no-store' } });
	} catch (err) {
		if (err instanceof UnitError) error(404, 'Nicht gefunden.');
		throw err;
	}
};

/** Gewählten Entra-Treffer anlegen und die Personen-ID zurückgeben. */
export const POST: RequestHandler = async ({ locals, params, request, url, getClientAddress }) => {
	// Legt Konten an: nur von der eigenen Seite (zusätzlich zu SameSite und CORS)
	if (request.headers.get('origin') !== url.origin) error(403, 'Nicht erlaubt.');
	const p = requirePrincipal(locals);
	const body = (await request.json().catch(() => null)) as { wahl?: unknown } | null;
	const wahl = typeof body?.wahl === 'string' ? body.wahl.slice(0, 80) : '';
	try {
		return json({ id: await personAusWahl(p, params.id ?? '', wahl, getClientAddress()) });
	} catch (err) {
		if (err instanceof UnitError) return json({ fehler: err.message }, { status: 400 });
		throw err;
	}
};
