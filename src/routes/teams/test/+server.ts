import type { RequestHandler } from '@sveltejs/kit';
import { TEAMS_FRAME_ANCESTORS } from '#lib/server/teams-frame.ts';

/**
 * Test-Tab der Teams-App (vorübergehend): prüft Anmeldung per SSO, Cookies
 * und den Sprung aus einer Benachrichtigung. Ohne Anmeldung erreichbar, zeigt
 * keine Inhalte des Intranets.
 */
const HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intranet · Teams-Test</title>
<style>
body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#f4f6f5;color:#18201c}
main{max-width:40rem;margin:0 auto;padding:1.5rem}
h1{font-size:1.4rem;margin:0 0 .25rem}
p{color:#525c57;margin:.25rem 0 1rem}
ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
li{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #d9dfdb}
li div{display:flex;flex-direction:column}
.zeichen{flex:none;width:24px;height:24px;border-radius:999px;display:grid;place-items:center;font-weight:700;color:#fff;background:#525c57}
.ok .zeichen{background:#0f6e56}.fehler .zeichen{background:#b42318}
button{margin-top:1rem;min-height:44px;padding:.5rem 1rem;border-radius:999px;border:0;background:#0f6e56;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:focus-visible{outline:3px solid #2f7de1;outline-offset:2px}
details{margin-top:1rem}pre{white-space:pre-wrap;font-size:12px;background:#fff;padding:10px;border-radius:10px;border:1px solid #d9dfdb}
@media (prefers-color-scheme:dark){body{background:#111614;color:#eaefec}p{color:#a6b0ab}li,pre{background:#1a201d;border-color:#2f3733}}
</style>
</head>
<body>
<main>
<h1>Teams-Test</h1>
<p>Prüft, ob das Intranet in Teams laufen kann. Es wird nichts gespeichert und keine Sitzung angelegt.</p>
<p id="status" role="status">Test läuft …</p>
<ul id="ergebnisse" aria-live="polite"></ul>
<button id="kopieren" type="button" hidden>Ergebnis kopieren</button>
<details id="roh"><summary>Ergebnis als Text</summary><pre id="rohtext"></pre></details>
</main>
<script src="/teams/test/teams.js"></script>
<script src="/teams/test/app.js"></script>
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
