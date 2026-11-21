import type { RequestHandler } from '@sveltejs/kit';
import { TEAMS_FRAME_ANCESTORS } from '#lib/server/teams-frame.ts';
import { safeTabTarget } from '#lib/teams.ts';

/**
 * Tab der Teams-App (Kap. 11.1): Ziel eines Klicks auf eine Teams-Benachrichtigung.
 * Ohne Anmeldung und ohne Inhalte; nur ein Link ins Intranet (Browser). Darf als
 * einzige Seite in Teams eingebettet werden; das Intranet selbst nicht.
 */
const FRAME = TEAMS_FRAME_ANCESTORS;

const esc = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);

export const GET: RequestHandler = ({ url }) => {
	// {subEntityId} bleibt wörtlich stehen, wenn Teams keinen Kontext mitgibt
	const raw = url.searchParams.get('ziel');
	const ziel = safeTabTarget(raw && !raw.startsWith('{') ? raw : '/');
	const href = esc(new URL(ziel, url.origin).href);
	const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Intranet</title>
<style>
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f6f5;color:#18201c}
main{max-width:28rem;padding:2rem;text-align:center}
a{display:inline-block;margin-top:1rem;padding:.75rem 1.25rem;border-radius:10px;background:#0f6e56;color:#fff;text-decoration:none;font-weight:600}
a:focus-visible{outline:3px solid #2f7de1;outline-offset:2px}
p{color:#525c57}
@media (prefers-color-scheme:dark){body{background:#111614;color:#eaefec}p{color:#a6b0ab}a{background:#5dcaa5;color:#111614}}
</style>
</head>
<body>
<main>
<h1>Intranet</h1>
<p>${ziel === '/' ? 'Öffne das Intranet in deinem Browser.' : 'Den Beitrag findest du im Intranet. Er öffnet sich in deinem Browser.'}</p>
<a href="${href}" target="_blank" rel="noopener noreferrer">${ziel === '/' ? 'Intranet öffnen' : 'Im Intranet öffnen'}</a>
</main>
</body>
</html>`;
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; ${FRAME}`,
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer'
		}
	});
};
