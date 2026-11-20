import { error } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readStored } from '#lib/server/files/store.ts';
import { photoFileFor } from '#lib/server/people.ts';
import type { RequestHandler } from './$types';

/** Profilfoto nur für Personen, die die Person sehen dürfen (Kap. 8.13). */
export const GET: RequestHandler = async ({ locals, params }) => {
	const fileId = await photoFileFor(requirePrincipal(locals), params.id);
	if (!fileId) error(404, 'Kein Foto.');
	const file = await readStored(fileId);
	if (!file || file.kind !== 'jpeg') error(404, 'Kein Foto.');
	return new Response(new Uint8Array(file.data), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Content-Length': String(file.data.length),
			// Adresse enthält die Fassung (?v=…); privat zwischenspeichern ist unbedenklich
			'Cache-Control': 'private, max-age=86400',
			'X-Content-Type-Options': 'nosniff',
			'Cross-Origin-Resource-Policy': 'same-origin',
			'Content-Security-Policy': "sandbox; default-src 'none'"
		}
	});
};
