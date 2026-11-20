import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { locations } from '#lib/server/db/schema.ts';
import { accentStyle, brandingFor } from '#lib/server/tenant-branding.ts';
import type { LayoutServerLoad } from './$types';

/** Eigene, schlanke Oberfläche nur für Betreiber-Konten (Kap. 4.3). */
export const load: LayoutServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	if (!p.operatorLocationId) error(404, 'Diese Seite gibt es nicht.');
	const [loc] = await db
		.select({ name: locations.name, active: locations.active })
		.from(locations)
		.where(eq(locations.id, p.operatorLocationId));
	const branding = await brandingFor(locals.person!.tenantId);
	return {
		standort: loc?.name ?? '',
		aktiv: loc?.active ?? false,
		ich: locals.person!.displayName,
		marke: { kurz: branding.short, name: branding.name },
		akzent: accentStyle(branding),
		theme: locals.theme
	};
};
