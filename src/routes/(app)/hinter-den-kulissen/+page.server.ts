import { fail, redirect } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import {
	enableableUnits,
	getExtraTenants,
	howTo,
	KulissenError,
	listPosts,
	react,
	setEnabled,
	setExtraTenants,
	writableUnits
} from '#lib/server/kulissen.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import type { Actions, PageServerLoad } from './$types';

/** Beiträge je Schritt „weitere anzeigen“ (Kap. 6.7) */
const SCHRITT = 24;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const anzahl = anzahlAus(url, SCHRITT, 2000);
	const [beitraege, schreibbar, freischalten, extra, mandanten, text, favs] = await Promise.all([
		listPosts(p, q, anzahl),
		writableUnits(p),
		enableableUnits(p),
		getExtraTenants(p),
		db
			.select({ id: tenants.id, name: tenants.name, short: tenants.shortName })
			.from(tenants)
			.orderBy(asc(tenants.name)),
		howTo(),
		listFavorites(p.personId)
	]);
	return {
		beitraege,
		gesamt: beitraege[0]?.gesamt ?? 0,
		anzahl,
		schritt: SCHRITT,
		q,
		darfSchreiben: schreibbar.length > 0,
		freischalten,
		soGehts: text,
		mandanten: mandanten.map((m) => ({
			...m,
			eigener: m.id === p.tenantId,
			an: m.id === p.tenantId || extra.includes(m.id)
		})),
		favorit: favs.some((f) => f.key === 'kulissen')
	};
};

export const actions: Actions = {
	aus: async ({ request, locals }) => {
		const f = await request.formData();
		await setExtraTenants(requirePrincipal(locals), f.getAll('aus').map(String));
		const zurueck = String(f.get('zurueck') ?? '');
		redirect(303, `/hinter-den-kulissen${zurueck.startsWith('?') ? zurueck : ''}`);
	},
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'kulissen');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	freischalten: async ({ request, locals, getClientAddress }) => {
		const f = await request.formData();
		try {
			await setEnabled(
				requirePrincipal(locals),
				String(f.get('einheit') ?? ''),
				f.get('an') === 'ja',
				getClientAddress()
			);
		} catch (err) {
			if (err instanceof KulissenError) return fail(403, { fehler: err.message });
			throw err;
		}
		return { ok: 'Gespeichert.' };
	},
	reagieren: async ({ request, locals }) => {
		const f = await request.formData();
		try {
			await react(
				requirePrincipal(locals),
				String(f.get('id') ?? ''),
				String(f.get('emoji') ?? '')
			);
		} catch (err) {
			if (err instanceof KulissenError) return fail(404, { fehler: err.message });
			throw err;
		}
		return {};
	}
};
