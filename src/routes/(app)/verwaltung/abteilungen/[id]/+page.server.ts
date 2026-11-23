import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { getContentRules } from '#lib/server/rules.ts';
import { readUnitForm } from '#lib/server/unit-form.ts';
import {
	addMember,
	administrableTenants,
	getUnitForAdmin,
	removeMember,
	setMemberRights,
	UnitError,
	updateUnit
} from '#lib/server/units.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const principal = requirePrincipal(locals);
	try {
		const [einheit, mandanten, regeln] = await Promise.all([
			getUnitForAdmin(principal, params.id),
			administrableTenants(principal),
			getContentRules()
		]);
		return { einheit, mandanten, maxSchreibende: regeln.writersMax };
	} catch (err) {
		if (err instanceof UnitError) error(404, err.message);
		throw err;
	}
};

async function guarded<T>(fn: () => Promise<T>) {
	try {
		await fn();
		return { gespeichert: true };
	} catch (err) {
		if (err instanceof UnitError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	speichern: async ({ request, locals, params, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		const input = readUnitForm(await request.formData());
		return guarded(() => updateUnit(principal, params.id, input, getClientAddress()));
	},
	hinzufuegen: async ({ request, locals, params, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		const email = String((await request.formData()).get('email') ?? '').slice(0, 320);
		return guarded(() => addMember(principal, params.id, email, getClientAddress()));
	},
	rechte: async ({ request, locals, params, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		const f = await request.formData();
		const on = (k: string) => f.get(k) === 'on';
		return guarded(() =>
			setMemberRights(
				principal,
				params.id,
				String(f.get('person') ?? ''),
				{
					isPrimary: on('primaer'),
					mayWriteNews: on('neuigkeiten'),
					mayWriteFaqs: on('faqs'),
					mayWriteEvents: on('termine'),
					mayWriteBehindScenes: on('kulissen'),
					// Nur bei Hubs gibt es das Feld
					mayWriteDocuments: f.has('dokumente_feld') ? on('dokumente') : undefined,
					mayWriteMedia: on('mediathek'),
					mayWriteSurveys: on('umfragen'),
					verwaltet: on('verwaltet'),
					fachpflege: f.has('fachpflege_feld') ? on('fachpflege') : undefined
				},
				getClientAddress()
			)
		);
	},
	entfernen: async ({ request, locals, params, getClientAddress }) => {
		const principal = requirePrincipal(locals);
		const person = String((await request.formData()).get('person') ?? '');
		return guarded(() => removeMember(principal, params.id, person, getClientAddress()));
	}
};
