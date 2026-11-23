import type { RequestHandler } from '@sveltejs/kit';
import { TEAMS_FRAME_ANCESTORS } from '#lib/server/teams-frame.ts';

/**
 * Einstieg der Teams-App (Inhalt des Reiters „Intranet“): meldet per SSO an
 * und öffnet dann das Ziel, z. B. den Beitrag aus einer Benachrichtigung.
 * Aus dem Aktivitätsfeed nur ein Hinweis mit Wechsel in die App.
 */
const HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intranet</title>
<style>
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f6f5;color:#18201c}
main{max-width:28rem;padding:2rem;text-align:center}
p{color:#525c57;margin:.5rem 0}
.aktionen{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:1rem}
button,a{display:inline-flex;align-items:center;min-height:44px;padding:0 1.1rem;border-radius:999px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
button{border:0;background:#0f6e56;color:#fff}
a{border:1px solid #d9dfdb;background:#fff;color:#18201c}
button:focus-visible,a:focus-visible{outline:3px solid #2f7de1;outline-offset:2px}
@media (prefers-color-scheme:dark){body{background:#111614;color:#eaefec}p{color:#a6b0ab}button{background:#5dcaa5;color:#111614}a{background:#1a201d;border-color:#2f3733;color:#eaefec}}
</style>
</head>
<body>
<main>
<h1>Intranet</h1>
<p id="status" role="status">Wird geöffnet …</p>
<div id="hinweis" hidden>
<p>Es gibt eine neue Benachrichtigung im Intranet.</p>
<div class="aktionen">
<button id="zurapp" type="button">In der Intranet-App öffnen</button>
<a id="hinweisbrowser" href="/" target="_blank" rel="noopener">Im Browser öffnen</a>
</div>
</div>
<div id="fehler" hidden>
<p id="fehlertext" role="alert"></p>
<div class="aktionen">
<button id="erneut" type="button">Noch einmal versuchen</button>
<a id="browser" href="/" target="_blank" rel="noopener">Im Browser öffnen</a>
</div>
</div>
</main>
<script src="/teams/teams.js"></script>
<script src="/teams/app/app.js"></script>
</body>
</html>`;

// connect-src: die Teams-Bibliothek lädt die Liste erlaubter Microsoft-Adressen von res.cdn.office.net
export const GET: RequestHandler = () =>
	new Response(HTML, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': `default-src 'none'; script-src 'self'; connect-src 'self' https://res.cdn.office.net; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; ${TEAMS_FRAME_ANCESTORS}`,
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer'
		}
	});
