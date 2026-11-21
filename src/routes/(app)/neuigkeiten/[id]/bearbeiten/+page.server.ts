import { mitBeschreibungen } from '#lib/server/files/beschreibung.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { dateToBerlinInput } from '#lib/news.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readNewsForm, type NewsFormValues } from '#lib/server/news-form.ts';
import {
	describeAttachments,
	NewsError,
	newsForEdit,
	saveNews,
	writableUnits
} from '#lib/server/news.ts';
import { getContentRules } from '#lib/server/rules.ts';
import type { Actions, PageServerLoad } from './$types';

const day = (d: Date | null) => (d ? dateToBerlinInput(d).slice(0, 10) : '');

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const n = await newsForEdit(p, params.id);
	if (!n) error(404, 'Diesen Beitrag gibt es nicht oder du darfst ihn nicht bearbeiten.');
	const now = Date.now();
	const werte: NewsFormValues = {
		unitId: n.unitId,
		title: n.title,
		bodyHtml: n.bodyHtml,
		publishAt: dateToBerlinInput(n.publishAt),
		expiresAt: day(n.expiresAt),
		pin: n.pinnedUntil !== null && n.pinnedUntil.getTime() > now,
		pinnedUntil: day(n.pinnedUntil),
		urgent: n.urgentUntil !== null && n.urgentUntil.getTime() > now,
		urgentUntil: n.urgentUntil ? dateToBerlinInput(n.urgentUntil) : '',
		urgentText: n.urgentText ?? '',
		allTenants: n.allTenants,
		tenantIds: n.tenantIds,
		replacePin: false,
		attachments: n.attachments
	};
	return {
		id: n.id,
		werte,
		// Absender bleibt beim Bearbeiten gleich
		einheiten: (await writableUnits(p)).filter((u) => u.id === n.unitId),
		mandanten: await db
			.select({ id: tenants.id, name: tenants.name })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		regeln: await getContentRules()
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const { input, values } = readNewsForm(await request.formData());
		const existing = await newsForEdit(p, params.id);
		if (!existing) error(404);
		input.unitId = existing.unitId;
		try {
			const r = await saveNews(p, input, getClientAddress(), params.id);
			if (!r.ok) {
				values.attachments = mitBeschreibungen(
					await describeAttachments(p, input.attachmentIds, params.id),
					input.descriptions ?? new Map()
				);
				return fail(400, { werte: values, fehler: r.errors, pinKonflikt: r.pinConflict ?? null });
			}
			redirect(303, `/neuigkeiten/${r.id}`);
		} catch (err) {
			if (err instanceof NewsError)
				return fail(403, { werte: values, fehler: { title: err.message }, pinKonflikt: null });
			throw err;
		}
	}
};
