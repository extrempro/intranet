import { mitBeschreibungen } from '#lib/server/files/beschreibung.ts';
import { error, fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { dateToBerlinInput } from '#lib/news.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { readNewsForm, type NewsFormValues } from '#lib/server/news-form.ts';
import { describeAttachments, NewsError, saveNews, writableUnits } from '#lib/server/news.ts';
import { getContentRules } from '#lib/server/rules.ts';
import {
	mitUmfrageRecht,
	UmfrageFehler,
	umfrageSpeichern,
	umfrageVorpruefen
} from '#lib/server/umfragen.ts';
import { entwuerfeListe, entwurfLaden, entwurfLoeschen } from '#lib/server/entwuerfe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const einheiten = mitUmfrageRecht(p, await writableUnits(p));
	if (einheiten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const entwurf = await entwurfLaden(p, url.searchParams.get('entwurf'), 'news');
	let werte: NewsFormValues = {
		// ?absender= z. B. vom Hub aus
		unitId: einheiten.find((e) => e.id === url.searchParams.get('absender'))?.id ?? einheiten[0].id,
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
		replacePin: false,
		attachments: [],
		umfrage: ''
	};
	if (entwurf) {
		const { input, values } = readNewsForm(entwurf.form);
		values.attachments = mitBeschreibungen(
			await describeAttachments(p, input.attachmentIds, undefined),
			input.descriptions ?? new Map()
		);
		werte = values;
	}
	return {
		einheiten,
		werte,
		entwurf: entwurf ? { id: entwurf.id, gespeichert: entwurf.gespeichert } : null,
		entwuerfe: entwurf ? [] : await entwuerfeListe(p, 'news'),
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
		const fd = await request.formData();
		const entwurf = String(fd.get('entwurf') ?? '') || null;
		const { input, values } = readNewsForm(fd);
		const einheit = (await writableUnits(p)).find((e) => e.id === input.unitId);
		const umfrage = await umfrageVorpruefen(p, einheit, values.umfrage);
		if (umfrage.fehler) {
			values.attachments = mitBeschreibungen(
				await describeAttachments(p, input.attachmentIds, undefined),
				input.descriptions ?? new Map()
			);
			return fail(400, {
				werte: values,
				fehler: { umfrage: umfrage.fehler },
				pinKonflikt: null,
				entwurf
			});
		}
		try {
			const r = await saveNews(p, input, getClientAddress());
			if (!r.ok) {
				values.attachments = mitBeschreibungen(
					await describeAttachments(p, input.attachmentIds, undefined),
					input.descriptions ?? new Map()
				);
				return fail(400, {
					werte: values,
					fehler: r.errors,
					pinKonflikt: r.pinConflict ?? null,
					entwurf
				});
			}
			if (umfrage.aendern) await umfrageSpeichern(p, r.id, umfrage.wert, getClientAddress());
			await entwurfLoeschen(p, entwurf);
			redirect(303, `/neuigkeiten/${r.id}`);
		} catch (err) {
			if (err instanceof NewsError || err instanceof UmfrageFehler)
				return fail(403, {
					werte: values,
					fehler: { title: err.message },
					pinKonflikt: null,
					entwurf
				});
			throw err;
		}
	}
};
