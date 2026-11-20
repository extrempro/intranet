import { error } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { teamsAppPackage } from '#lib/server/teams.ts';
import type { RequestHandler } from './$types';

/** App-Paket für das Teams Admin Center (nur System-Admins). */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!isSystemAdmin(requirePrincipal(locals))) error(403, 'Das dürfen nur System-Admins.');
	const origin = process.env.ORIGIN?.trim() || url.origin;
	try {
		const p = await teamsAppPackage(origin);
		return new Response(new Uint8Array(p.data), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${p.name}"`,
				'Cache-Control': 'no-store'
			}
		});
	} catch (err) {
		error(400, err instanceof Error ? err.message : 'Paket konnte nicht erstellt werden.');
	}
};
