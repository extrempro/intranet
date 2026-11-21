import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { getAgreement } from '#lib/server/legal.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const v = await getAgreement(requirePrincipal(locals), params.id);
	if (!v) error(404, 'Diese Vereinbarung gibt es nicht oder nicht mehr.');
	const [t] = await db
		.select({ name: tenants.name })
		.from(tenants)
		.where(eq(tenants.id, v.tenantId));
	return { v, mandant: t?.name ?? '' };
};
