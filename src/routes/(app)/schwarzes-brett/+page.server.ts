import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	allTenantsList,
	approveAd,
	askAuthor,
	BoardError,
	categories,
	categoryCounts,
	contactAuthor,
	deleteAd,
	dismissReports,
	extendAd,
	getBoardTenants,
	isModerator,
	listAds,
	markDone,
	moderationQueue,
	myAds,
	rejectAd,
	reportAd,
	setBoardTenants
} from '#lib/server/board.ts';
import { listFavorites, toggleFavorite } from '#lib/server/preferences.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const mod = isModerator(p);
	const wunsch = url.searchParams.get('ansicht');
	const ansicht =
		wunsch === 'meine' ? 'meine' : wunsch === 'moderation' && mod ? 'moderation' : 'alle';
	const kategorie = url.searchParams.get('kategorie');
	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const [kats, zaehler, extra, mandanten, favs] = await Promise.all([
		categories(),
		categoryCounts(p),
		getBoardTenants(p),
		allTenantsList(),
		listFavorites(p.personId)
	]);
	return {
		ansicht,
		moderator: mod,
		kategorie: kats.find((k) => k.id === kategorie)?.id ?? null,
		q,
		kategorien: kats.map((k) => ({ ...k, n: zaehler[k.id] ?? 0 })),
		mandanten: mandanten.map((m) => ({
			...m,
			eigener: m.id === p.tenantId,
			an: m.id === p.tenantId || extra.includes(m.id)
		})),
		anzeigen: ansicht === 'alle' ? await listAds(p, { categoryId: kategorie, q }) : [],
		meine: ansicht === 'meine' ? await myAds(p) : [],
		pruefen: ansicht === 'moderation' ? await moderationQueue(p) : [],
		neu: url.searchParams.has('neu'),
		favorit: favs.some((f) => f.key === 'schwarzes-brett')
	};
};

const id = (f: FormData) => String(f.get('id') ?? '');

async function run(fn: () => Promise<unknown>, ok: Record<string, unknown>) {
	try {
		await fn();
		return ok;
	} catch (err) {
		if (err instanceof BoardError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	aus: async ({ request, locals }) => {
		const f = await request.formData();
		await setBoardTenants(requirePrincipal(locals), f.getAll('aus').map(String));
		const zurueck = String(f.get('zurueck') ?? '');
		redirect(303, `/schwarzes-brett${zurueck.startsWith('?') ? zurueck : ''}`);
	},
	favorit: async ({ locals }) => {
		const r = await toggleFavorite(requirePrincipal(locals).personId, 'schwarzes-brett');
		if (r === 'full')
			return fail(400, {
				fehler: 'Du hast schon 8 Favoriten. Entferne zuerst einen auf der Startseite.'
			});
		return { favorit: r };
	},
	nachricht: async ({ request, locals }) => {
		const f = await request.formData();
		let conv: string;
		try {
			conv = await contactAuthor(requirePrincipal(locals), id(f));
		} catch (err) {
			if (err instanceof BoardError) return fail(400, { fehler: err.message });
			throw err;
		}
		redirect(303, `/nachrichten/${conv}`);
	},
	melden: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => reportAd(requirePrincipal(locals), id(f), String(f.get('grund') ?? '')), {
			ok: 'Danke für den Hinweis. Die Moderation schaut sich die Anzeige an.'
		});
	},
	verlaengern: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => extendAd(requirePrincipal(locals), id(f)), { ok: 'Um 30 Tage verlängert.' });
	},
	erledigt: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => markDone(requirePrincipal(locals), id(f)), {
			ok: 'Als erledigt markiert. Gespräche dazu sind geschlossen.'
		});
	},
	loeschen: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => deleteAd(requirePrincipal(locals), id(f)), { ok: 'Anzeige gelöscht.' });
	},
	freigeben: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => approveAd(requirePrincipal(locals), id(f)), { ok: 'Freigegeben.' });
	},
	ablehnen: async ({ request, locals }) => {
		const f = await request.formData();
		return run(
			() => rejectAd(requirePrincipal(locals), id(f), String(f.get('begruendung') ?? '')),
			{ ok: 'Erledigt. Die Person hat deine Begründung als Nachricht bekommen.' }
		);
	},
	behalten: async ({ request, locals }) => {
		const f = await request.formData();
		return run(() => dismissReports(requirePrincipal(locals), id(f)), {
			ok: 'Meldung zurückgewiesen. Die Anzeige bleibt.'
		});
	},
	rueckfrage: async ({ request, locals }) => {
		const f = await request.formData();
		let conv: string;
		try {
			conv = await askAuthor(requirePrincipal(locals), id(f));
		} catch (err) {
			if (err instanceof BoardError) return fail(400, { fehler: err.message });
			throw err;
		}
		redirect(303, `/nachrichten/${conv}`);
	}
};
