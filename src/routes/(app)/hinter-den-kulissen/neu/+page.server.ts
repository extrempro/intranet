import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readPostForm } from '#lib/server/kulissen-form.ts';
import { describeFiles, savePost, writableUnits } from '#lib/server/kulissen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const einheiten = await writableUnits(p);
	if (!einheiten.length) error(403, 'Dafür fehlt dir das Recht.');
	return {
		einheiten,
		mandanten: await db
			.select({ id: tenants.id, name: tenants.name })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		werte: {
			unitId: einheiten[0].id,
			title: '',
			bodyHtml: '',
			tenantIds: [],
			attachments: [],
			consent: false
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const input = readPostForm(await request.formData());
		const r = await savePost(p, null, input);
		if (!r.ok)
			return fail(400, {
				werte: { ...input, attachments: await describeFiles(p, input.attachmentIds, null) },
				fehler: r.errors
			});
		redirect(303, `/hinter-den-kulissen/${r.id}`);
	}
};
