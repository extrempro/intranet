import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { FAVORITES_MAX, HOME_CARDS, resolveLayout } from '#lib/home.ts';
import { audit } from '#lib/server/audit.ts';
import { canAdministerTenant } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants } from '#lib/server/db/schema.ts';
import { defaultFavoritesFor, favoriteChoices } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tenantFor(locals: App.Locals, id: string) {
	const p = requirePrincipal(locals);
	if (!GUID.test(id) || !canAdministerTenant(p, id)) error(404, 'Diesen Mandanten gibt es nicht.');
	const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
	if (!t) error(404, 'Diesen Mandanten gibt es nicht.');
	return { p, t };
}

/** Startseite für neue Personen (Kap. 3.1, 7): Karten und Favoriten je Mandant. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const { t } = await tenantFor(locals, params.id);
	return {
		mandant: { id: t.id, name: t.name },
		karten: resolveLayout(HOME_CARDS, null, t.homeDefault),
		favoriten: await defaultFavoritesFor(t.id),
		auswahl: await favoriteChoices(t.id),
		max: FAVORITES_MAX
	};
};

function list(v: FormDataEntryValue | null): string[] | null {
	try {
		const x = JSON.parse(String(v ?? ''));
		return Array.isArray(x) && x.length <= 50 && x.every((s) => typeof s === 'string') ? x : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	default: async ({ request, locals, params, getClientAddress }) => {
		const { p, t } = await tenantFor(locals, params.id);
		const f = await request.formData();
		const order = list(f.get('reihenfolge'));
		const hidden = list(f.get('ausgeblendet'));
		const favs = list(f.get('favoriten'));
		if (!order || !hidden || !favs) return fail(400, { fehler: 'Ungültige Angaben.' });
		const known = new Set(HOME_CARDS.map((c) => c.id));
		const choices = new Set((await favoriteChoices(t.id)).map((c) => c.key));
		const favoriten = [...new Set(favs.filter((k) => choices.has(k)))].slice(0, FAVORITES_MAX);
		await db
			.update(tenants)
			.set({
				homeDefault: {
					order: order.filter((id) => known.has(id)),
					hidden: hidden.filter((id) => known.has(id))
				},
				defaultFavorites: favoriten
			})
			.where(eq(tenants.id, t.id));
		await audit({
			category: 'admin',
			action: 'tenant.favorites',
			actorId: p.personId,
			tenantId: t.id,
			entityType: 'tenant',
			entityId: t.id,
			details: { favoriten, ausgeblendet: hidden.filter((id) => known.has(id)) },
			ip: getClientAddress()
		});
		return { gespeichert: true };
	}
};
