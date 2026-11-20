import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { dateToBerlinInput } from '#lib/news.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readNewsForm, type NewsFormValues } from '#lib/server/news-form.ts';
import { NewsError, saveNews, writableUnits } from '#lib/server/news.ts';
import { getContentRules } from '#lib/server/rules.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const einheiten = await writableUnits(p);
	if (einheiten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const werte: NewsFormValues = {
		unitId: einheiten[0].id,
		title: '',
		bodyHtml: '',
		publishAt: dateToBerlinInput(new Date()),
		expiresAt: '',
		pin: false,
		pinnedUntil: '',
		urgent: false,
		urgentUntil: '',
		urgentText: '',
		allTenants: true,
		tenantIds: [],
		replacePin: false
	};
	return {
		einheiten,
		werte,
		mandanten: await db
			.select({ id: tenants.id, name: tenants.name })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		regeln: await getContentRules()
	};
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const { input, values } = readNewsForm(await request.formData());
		try {
			const r = await saveNews(p, input, getClientAddress());
			if (!r.ok)
				return fail(400, { werte: values, fehler: r.errors, pinKonflikt: r.pinConflict ?? null });
			redirect(303, `/neuigkeiten/${r.id}`);
		} catch (err) {
			if (err instanceof NewsError)
				return fail(403, { werte: values, fehler: { title: err.message }, pinKonflikt: null });
			throw err;
		}
	}
};
