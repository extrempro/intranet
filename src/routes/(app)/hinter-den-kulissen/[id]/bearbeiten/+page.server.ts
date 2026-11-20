import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readPostForm } from '#lib/server/kulissen-form.ts';
import {
	describeFiles,
	forEdit,
	KulissenError,
	savePost,
	writableUnits
} from '#lib/server/kulissen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const post = await forEdit(p, params.id);
	if (!post) error(404, 'Diesen Beitrag gibt es nicht oder du darfst ihn nicht bearbeiten.');
	return {
		id: post.id,
		einheiten: await writableUnits(p),
		mandanten: await db
			.select({ id: tenants.id, name: tenants.name })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		werte: {
			unitId: post.unitId,
			title: post.title,
			bodyHtml: post.bodyHtml,
			tenantIds: post.targets.map((t) => t.id),
			attachments: [...post.images, ...post.files],
			consent: false
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const input = readPostForm(await request.formData());
		try {
			const r = await savePost(p, params.id, input);
			if (!r.ok)
				return fail(400, {
					werte: { ...input, attachments: await describeFiles(p, input.attachmentIds, params.id) },
					fehler: r.errors
				});
		} catch (err) {
			if (err instanceof KulissenError) error(404, err.message);
			throw err;
		}
		redirect(303, `/hinter-den-kulissen/${params.id}`);
	}
};
