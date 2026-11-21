import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mitBeschreibungen } from '#lib/server/files/beschreibung.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readPostForm } from '#lib/server/kulissen-form.ts';
import { describeFiles, savePost, writableUnits } from '#lib/server/kulissen.ts';
import { entwuerfeListe, entwurfLaden, entwurfLoeschen } from '#lib/server/entwuerfe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const einheiten = await writableUnits(p);
	if (!einheiten.length) error(403, 'Dafür fehlt dir das Recht.');
	const entwurf = await entwurfLaden(p, url.searchParams.get('entwurf'), 'kulissen');
	const ausEntwurf = entwurf ? readPostForm(entwurf.form) : null;
	return {
		entwurf: entwurf ? { id: entwurf.id, gespeichert: entwurf.gespeichert } : null,
		entwuerfe: entwurf ? [] : await entwuerfeListe(p, 'kulissen'),
		einheiten,
		mandanten: await db
			.select({ id: tenants.id, name: tenants.name })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		werte: ausEntwurf
			? {
					...ausEntwurf,
					attachments: mitBeschreibungen(
						await describeFiles(p, ausEntwurf.attachmentIds, null),
						ausEntwurf.descriptions ?? new Map()
					)
				}
			: {
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
		const fd = await request.formData();
		const entwurf = String(fd.get('entwurf') ?? '') || null;
		const input = readPostForm(fd);
		const r = await savePost(p, null, input);
		if (!r.ok)
			return fail(400, {
				werte: {
					...input,
					attachments: mitBeschreibungen(
						await describeFiles(p, input.attachmentIds, null),
						input.descriptions ?? new Map()
					)
				},
				fehler: r.errors,
				entwurf
			});
		await entwurfLoeschen(p, entwurf);
		redirect(303, `/hinter-den-kulissen/${r.id}`);
	}
};
