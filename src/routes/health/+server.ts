import type { RequestHandler } from '@sveltejs/kit';

/** Zustandsprüfung für Docker und den Reverse Proxy. Gibt keine Details preis. */
export const GET: RequestHandler = () =>
	new Response('ok', { headers: { 'Cache-Control': 'no-store' } });
