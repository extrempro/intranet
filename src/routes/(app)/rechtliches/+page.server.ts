import { fail } from '@sveltejs/kit';
import type { LegalLinkErrors } from '#lib/legal.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	deleteLegalLink,
	LegalError,
	listLegal,
	maintainableTenants,
	moveLegalLink,
	saveLegalLink
} from '#lib/server/legal.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const [liste, mandanten, favs] = await Promise.all([
		listLegal(p, url.searchParams.get('mandant') ?? p.tenantId),
		maintainableTenants(p),
		listFavorites(p.personId)
	]);
	return {
		...liste,
		mandanten,
		eigenerMandant: p.tenantId,
		favorit: favs.some((f) => f.key === 'rechtliches')
	};
};

const str = (f: FormData, k: string, max = 1000) => String(f.get(k) ?? '').slice(0, max);

async function guard(fn: () => Promise<unknown>, ok: Record<string, unknown>) {
	try {
		await fn();
		return ok;
	} catch (err) {
		if (err instanceof LegalError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'rechtliches');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	eintrag: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const id = str(f, 'id', 40) || null;
		const eintrag = id ?? 'neu';
		let r;
		try {
			r = await saveLegalLink(
				p,
				id,
				str(f, 'mandant', 40),
				{
					kind: str(f, 'art', 20),
					title: str(f, 'titel', 400),
					description: str(f, 'beschreibung'),
					url: str(f, 'adresse', 1000)
				},
				f.getAll('anhaenge').map(String)[0] ?? null
			);
		} catch (err) {
			if (err instanceof LegalError) return fail(400, { fehler: err.message, eintrag });
			throw err;
		}
		if (!r.ok)
			return fail(400, {
				fehler: 'Bitte prüfe die markierten Felder.',
				felder: r.errors as LegalLinkErrors,
				eintrag
			});
		return { ok: id ? 'Eintrag gespeichert.' : 'Eintrag hinzugefügt.', eintrag, gespeichert: true };
	},
	eintragLoeschen: async ({ request, locals }) => {
		const id = str(await request.formData(), 'id', 40);
		return guard(() => deleteLegalLink(requirePrincipal(locals), id), {
			ok: 'Eintrag gelöscht.'
		});
	},
	eintragVerschieben: async ({ request, locals }) => {
		const f = await request.formData();
		return guard(
			() =>
				moveLegalLink(
					requirePrincipal(locals),
					str(f, 'id', 40),
					f.get('richtung') === 'hoch' ? -1 : 1
				),
			{}
		);
	}
};
