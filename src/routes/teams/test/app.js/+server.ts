import type { RequestHandler } from '@sveltejs/kit';
import skript from '#lib/teams-test/app.js?raw';

export const GET: RequestHandler = () =>
	new Response(skript, {
		headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }
	});
