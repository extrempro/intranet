import { error, type RequestHandler } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { sichtbar } from '#lib/server/mediathek.ts';

const ts = (s: number) => {
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sek = s % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sek).padStart(2, '0')}.000`;
};

/** Kapitelspur (WebVTT, kind="chapters"), erzeugt aus den gespeicherten Kapiteln. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const s = await sichtbar(requirePrincipal(locals), params.id as string);
	if (!s) error(404, 'Nicht gefunden');
	const k = s.v.chapters;
	const zeilen = ['WEBVTT', ''];
	k.forEach((c, i) => {
		const ende = k[i + 1]?.s ?? Math.max(c.s + 1, s.v.durationSec);
		zeilen.push(`${ts(c.s)} --> ${ts(ende)}`, c.t.replace(/[<>]/g, ''), '');
	});
	return new Response(zeilen.join('\n'), {
		headers: {
			'Content-Type': 'text/vtt; charset=utf-8',
			'Cache-Control': 'private, no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
