import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	askApplicant,
	createHubFromApplication,
	forwardToAdministration,
	HubError,
	listApplications,
	mayReviewApplications,
	myApplications,
	rejectApplication,
	type ApplicationRole
} from '#lib/server/hubs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const pruefen = mayReviewApplications(p);
	const erledigt = url.searchParams.get('status') === 'erledigt';
	return {
		pruefen,
		erledigt,
		antraege: pruefen ? await listApplications(p, !erledigt) : [],
		meine: await myApplications(p),
		gesendet: url.searchParams.has('gesendet')
	};
};

const id = (f: FormData) => String(f.get('id') ?? '');

async function run<T>(fn: () => Promise<T>) {
	try {
		return { ok: true as const, value: await fn() };
	} catch (err) {
		if (err instanceof HubError) return { ok: false as const, fehler: err.message };
		throw err;
	}
}

export const actions: Actions = {
	rueckfrage: async ({ request, locals }) => {
		const f = await request.formData();
		const rolle = (f.get('rolle') === 'verwaltung' ? 'verwaltung' : 'redaktion') as ApplicationRole;
		const r = await run(() => askApplicant(requirePrincipal(locals), id(f), rolle));
		if (!r.ok) return fail(400, { fehler: r.fehler });
		redirect(303, `/nachrichten/${r.value}`);
	},
	weitergeben: async ({ request, locals }) => {
		const f = await request.formData();
		const r = await run(() => forwardToAdministration(requirePrincipal(locals), id(f)));
		return r.ok ? { ok: 'An die Verwaltung gegeben.' } : fail(400, { fehler: r.fehler });
	},
	anlegen: async ({ request, locals, getClientAddress }) => {
		const f = await request.formData();
		const r = await run(() =>
			createHubFromApplication(requirePrincipal(locals), id(f), getClientAddress())
		);
		if (!r.ok) return fail(400, { fehler: r.fehler });
		redirect(303, `/hubs/${r.value}`);
	},
	ablehnen: async ({ request, locals, getClientAddress }) => {
		const f = await request.formData();
		const r = await run(() =>
			rejectApplication(
				requirePrincipal(locals),
				id(f),
				String(f.get('begruendung') ?? ''),
				getClientAddress()
			)
		);
		return r.ok
			? { ok: 'Abgelehnt. Die Person hat die Begründung als Nachricht bekommen.' }
			: fail(400, { fehler: r.fehler });
	}
};
