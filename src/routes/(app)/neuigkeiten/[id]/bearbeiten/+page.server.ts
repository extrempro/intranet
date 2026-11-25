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
import {
	mitUmfrageRecht,
	umfrageFuerEditor,
	UmfrageFehler,
	umfrageSpeichern,
	umfrageVorpruefen
} from '#lib/server/umfragen.ts';
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
		teamScope: n.teamScope ?? '',
		replacePin: false,
		attachments: n.attachments
	};
	const umfrage = await umfrageFuerEditor(n.id);
	werte.umfrage = umfrage.wert ? JSON.stringify(umfrage.wert) : '';
	return {
		id: n.id,
		werte,
		// Absender bleibt beim Bearbeiten gleich
		einheiten: await mitUmfrageRecht(
			p,
			(await writableUnits(p)).filter((u) => u.id === n.unitId)
		),
		umfrageGesperrt: umfrage.gesperrt,
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
		const einheit = (await writableUnits(p)).find((e) => e.id === existing.unitId);
		const umfrage = await umfrageVorpruefen(p, einheit, values.umfrage, params.id);
		if (umfrage.fehler) {
			values.attachments = mitBeschreibungen(
				await describeAttachments(p, input.attachmentIds, params.id),
				input.descriptions ?? new Map()
			);
			return fail(400, { werte: values, fehler: { umfrage: umfrage.fehler }, pinKonflikt: null });
		}
		try {
			const r = await saveNews(p, input, getClientAddress(), params.id);
			if (!r.ok) {
				values.attachments = mitBeschreibungen(
					await describeAttachments(p, input.attachmentIds, params.id),
					input.descriptions ?? new Map()
				);
				return fail(400, { werte: values, fehler: r.errors, pinKonflikt: r.pinConflict ?? null });
			}
			if (umfrage.aendern) await umfrageSpeichern(p, r.id, umfrage.wert, getClientAddress());
			redirect(303, `/neuigkeiten/${r.id}`);
		} catch (err) {
			if (err instanceof NewsError || err instanceof UmfrageFehler)
				return fail(403, { werte: values, fehler: { title: err.message }, pinKonflikt: null });
			throw err;
		}
	}
};
