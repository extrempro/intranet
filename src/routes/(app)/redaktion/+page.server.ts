import { fail } from '@sveltejs/kit';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import { editorialWorklist, mayOpenEditorial } from '#lib/server/redaktion.ts';
import {
	beitragEingreifen,
	EingriffFehler,
	faqNochAktuell,
	type BeitragEingriff
} from '#lib/server/redaktion-eingriffe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	requireThat(mayOpenEditorial(p));
	return { liste: await editorialWorklist(p) };
};

async function guarded(fn: () => Promise<unknown>, ok: string) {
	try {
		await fn();
		return { ok };
	} catch (err) {
		if (err instanceof EingriffFehler) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	/** Bei fremden Beiträgen eingreifen (Kap. 10) */
	beitrag: async ({ locals, request, getClientAddress }) => {
		const f = await request.formData();
		const art = String(f.get('art') ?? '');
		if (!['loesen', 'dringend', 'beenden'].includes(art))
			return fail(400, { fehler: 'Unbekannt.' });
		return guarded(
			() =>
				beitragEingreifen(
					requirePrincipal(locals),
					String(f.get('id') ?? ''),
					art as BeitragEingriff,
					getClientAddress()
				),
			art === 'loesen'
				? 'Anheften gelöst.'
				: art === 'dringend'
					? 'Dringende Meldung beendet.'
					: 'Beitrag beendet.'
		);
	},
	/** Lange nicht geänderte FAQ als „noch aktuell“ bestätigen */
	faqAktuell: async ({ locals, request, getClientAddress }) => {
		const id = String((await request.formData()).get('id') ?? '');
		return guarded(
			() => faqNochAktuell(requirePrincipal(locals), id, getClientAddress()),
			'Als noch aktuell vermerkt.'
		);
	}
};
