import { fail, redirect } from '@sveltejs/kit';
import { isMonth } from '#lib/calendar.ts';
import { addDays, berlinNow } from '#lib/canteen.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	allTenants,
	eventWritableUnits,
	getCalendarTenants,
	listEvents,
	setCalendarTenants
} from '#lib/server/calendar.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const heute = berlinNow().date;
	const monatsansicht = url.searchParams.get('ansicht') === 'monat';
	const tagParam = url.searchParams.get('tag');
	const tag = tagParam && ISO.test(tagParam) ? tagParam : null;
	const monatParam = url.searchParams.get('monat');
	const monat = isMonth(monatParam) ? monatParam : (tag ?? heute).slice(0, 7);
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';

	const [extra, mandanten, schreibbar, favs] = await Promise.all([
		getCalendarTenants(p),
		allTenants(),
		eventWritableUnits(p),
		listFavorites(p.personId)
	]);

	// Liste: ab heute (bzw. gewähltem Tag) 90 Tage, bei Suche ein Jahr; Monat: ganzer Monat
	const von = monatsansicht ? `${monat}-01` : q ? heute : (tag ?? heute);
	const bis = monatsansicht ? addDays(`${monat}-01`, 31) : addDays(von, q ? 365 : 90);
	const termine = (await listEvents(p, { from: von, to: bis, tenantIds: extra, q })).filter(
		(t) => !monatsansicht || t.date.startsWith(monat)
	);

	return {
		heute,
		monatsansicht,
		monat,
		tag: monatsansicht ? (tag ?? (heute.startsWith(monat) ? heute : null)) : tag,
		q,
		termine,
		mandanten: mandanten.map((m) => ({
			...m,
			eigener: m.id === p.tenantId,
			an: m.id === p.tenantId || extra.includes(m.id)
		})),
		darfAnlegen: schreibbar.length > 0,
		favorit: favs.some((f) => f.key === 'kalender')
	};
};

export const actions: Actions = {
	aus: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		await setCalendarTenants(p, f.getAll('aus').map(String));
		const zurueck = String(f.get('zurueck') ?? '');
		// Nur Suchparameter der eigenen Seite übernehmen (kein offener Redirect)
		redirect(303, `/kalender${zurueck.startsWith('?') ? zurueck : ''}`);
	},
	favorit: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const r = await toggleFavorite(p.personId, 'kalender');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	}
};
