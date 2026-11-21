import type { RequestHandler } from '@sveltejs/kit';
import bibliothek from '@microsoft/teams-js/dist/umd/MicrosoftTeams.min.js?raw';

/** Teams-JavaScript-Bibliothek, vom eigenen Server (keine fremden Skripte). */
export const GET: RequestHandler = () =>
	new Response(bibliothek, {
		headers: {
			'Content-Type': 'text/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
