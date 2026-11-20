/**
 * Öffentliche Bilder des Mandanten (Logo, App-Symbol) und das Manifest für
 * „Zum Startbildschirm“. Nur feste Dateinamen, nur PNG aus der Prüfung.
 */
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readImage, type MarkenArt } from '#lib/server/marke.ts';
import type { RequestHandler } from './$types';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATEIEN: Record<string, MarkenArt> = {
	'logo-hell.png': 'logo_hell',
	'logo-dunkel.png': 'logo_dunkel',
	'symbol-32.png': 'symbol_32',
	'symbol-180.png': 'symbol_180',
	'symbol-192.png': 'symbol_192',
	'symbol-512.png': 'symbol_512'
};

function cache(url: URL) {
	// Mit Stand in der Adresse ändert sich der Inhalt nie
	return url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
}

export const GET: RequestHandler = async ({ params, url }) => {
	if (!GUID.test(params.id)) error(404, 'Nicht gefunden.');

	if (params.datei === 'manifest.webmanifest') {
		const [t] = await db
			.select({ name: tenants.name, accent: tenants.accentColor, bg: tenants.bgColor })
			.from(tenants)
			.where(eq(tenants.id, params.id));
		if (!t) error(404, 'Nicht gefunden.');
		const v = url.searchParams.get('v')?.replace(/\D/g, '').slice(0, 16) ?? '';
		const icon = (n: number, purpose: string) => ({
			src: `/marke/${params.id}/symbol-${n}.png${v ? `?v=${v}` : ''}`,
			sizes: `${n}x${n}`,
			type: 'image/png',
			purpose
		});
		const manifest = {
			name: `Intranet ${t.name}`,
			short_name: 'Intranet',
			description: 'Neuigkeiten, Organisation, Wissen und Service',
			lang: 'de',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			background_color: t.bg ?? '#f4f6f5',
			theme_color: t.accent ?? '#0f6e56',
			icons: [icon(192, 'any'), icon(512, 'any'), icon(192, 'maskable'), icon(512, 'maskable')]
		};
		return new Response(JSON.stringify(manifest), {
			headers: {
				'Content-Type': 'application/manifest+json; charset=utf-8',
				'Cache-Control': cache(url)
			}
		});
	}

	const art = DATEIEN[params.datei];
	if (!art) error(404, 'Nicht gefunden.');
	const bild = await readImage(params.id, art);
	if (!bild) error(404, 'Nicht gefunden.');
	return new Response(new Uint8Array(bild.data), {
		headers: {
			'Content-Type': 'image/png',
			'Content-Length': String(bild.data.byteLength),
			'Cache-Control': cache(url),
			'X-Content-Type-Options': 'nosniff',
			'Content-Disposition': 'inline'
		}
	});
};
