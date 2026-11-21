import { json, type RequestHandler } from '@sveltejs/kit';
import { randomToken } from '#lib/server/crypto.ts';

/**
 * Teams-Test: Kommt ein Cookie im eingebetteten Tab zurück? Zwei Varianten,
 * mit und ohne „Partitioned“ (CHIPS). Inhalt ist ein Zufallswert ohne Bedeutung.
 */
const MIT = '__Host-intranet-teamstest-p';
const OHNE = '__Host-intranet-teamstest';

function lesen(header: string | null, name: string): string | null {
	for (const teil of (header ?? '').split(';')) {
		const [k, ...v] = teil.trim().split('=');
		if (k === name) return v.join('=');
	}
	return null;
}

export const POST: RequestHandler = () => {
	const wert = randomToken().slice(0, 16);
	const basis = `Path=/; Secure; HttpOnly; SameSite=None; Max-Age=300`;
	const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
	headers.append('Set-Cookie', `${MIT}=${wert}; ${basis}; Partitioned`);
	headers.append('Set-Cookie', `${OHNE}=${wert}; ${basis}`);
	return new Response(JSON.stringify({ wert }), { headers });
};

export const GET: RequestHandler = ({ request }) => {
	const c = request.headers.get('cookie');
	return json(
		{ partitioniert: lesen(c, MIT), normal: lesen(c, OHNE) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
