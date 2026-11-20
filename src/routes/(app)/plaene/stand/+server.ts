import { json } from '@sveltejs/kit';
import { inArray } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { plans } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stand offline gespeicherter Pläne (Kap. 8.6): aktuelle Datei je Plan,
 * null = gelöscht. Pläne sind für alle Angemeldeten abrufbar.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePrincipal(locals);
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.filter((x) => GUID.test(x))
		.slice(0, 50);
	const rows = ids.length
		? await db
				.select({
					id: plans.id,
					fileId: plans.fileId,
					title: plans.title,
					validUntil: plans.validUntil
				})
				.from(plans)
				.where(inArray(plans.id, ids))
		: [];
	const out = Object.fromEntries(
		ids.map((id) => {
			const r = rows.find((x) => x.id === id);
			return [id, r ? { fileId: r.fileId, title: r.title, validUntil: r.validUntil } : null];
		})
	);
	return json(out, { headers: { 'Cache-Control': 'private, no-store' } });
};
