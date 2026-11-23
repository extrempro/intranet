import { error, fail } from '@sveltejs/kit';
import type { ResponsibilityInput } from '#lib/departments.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	createResponsibility,
	deleteResponsibility,
	DepartmentError,
	getDepartmentForEdit,
	markReviewed,
	moveResponsibility,
	ResponsibilityValidationError,
	setBehindScenes,
	updateDepartmentPage,
	updateResponsibility
} from '#lib/server/departments.ts';
import { addMember, removeMember, setMemberRights, UnitError } from '#lib/server/units.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const einheit = await getDepartmentForEdit(requirePrincipal(locals), params.slug);
	if (!einheit) error(404, 'Diese Abteilung gibt es nicht oder du darfst sie nicht bearbeiten.');
	return { einheit };
};

async function unitId(locals: App.Locals, slug: string) {
	const e = await getDepartmentForEdit(requirePrincipal(locals), slug);
	if (!e) error(404, 'Diese Abteilung gibt es nicht.');
	return e.id;
}

async function guard(fn: () => Promise<unknown>, ok: Record<string, unknown>, extra = {}) {
	try {
		await fn();
		return ok;
	} catch (err) {
		if (err instanceof ResponsibilityValidationError)
			return fail(400, { fehler: err.message, felder: err.errors, ...extra });
		if (err instanceof DepartmentError || err instanceof UnitError)
			return fail(400, { fehler: err.message, ...extra });
		throw err;
	}
}

const str = (f: FormData, k: string, max = 3000) => String(f.get(k) ?? '').slice(0, max);

function readResponsibility(f: FormData): ResponsibilityInput {
	return {
		topic: str(f, 'thema', 300),
		description: str(f, 'beschreibung', 1000),
		keywords: str(f, 'stichwoerter', 1000),
		groupName: str(f, 'gruppe', 200),
		personId: str(f, 'person', 40),
		deputyId: str(f, 'vertretung', 40),
		links: str(f, 'links', 4000)
	};
}

export const actions: Actions = {
	seite: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		const id = await unitId(locals, params.slug);
		return guard(
			() =>
				updateDepartmentPage(
					requirePrincipal(locals),
					id,
					{
						about: str(f, 'ueber', 4000),
						lead: str(f, 'leitung', 40),
						secondLead: str(f, 'zweite', 40),
						deputy: str(f, 'stellvertretung', 40),
						tagline: str(f, 'kurz', 200),
						email: str(f, 'funktionsadresse', 300),
						phone: str(f, 'telefon', 60),
						hours: str(f, 'sprechzeiten', 200),
						room: str(f, 'raum', 100)
					},
					getClientAddress()
				),
			{ ok: 'Seite gespeichert.' }
		);
	},
	kulissen: async ({ request, locals, params, getClientAddress }) => {
		const an = (await request.formData()).get('an') === 'ja';
		const id = await unitId(locals, params.slug);
		return guard(() => setBehindScenes(requirePrincipal(locals), id, an, getClientAddress()), {
			ok: an ? '„Hinter den Kulissen“ ist freigeschaltet.' : '„Hinter den Kulissen“ ist aus.'
		});
	},
	hinzufuegen: async ({ request, locals, params, getClientAddress }) => {
		const email = str(await request.formData(), 'email', 320);
		const id = await unitId(locals, params.slug);
		return guard(() => addMember(requirePrincipal(locals), id, email, getClientAddress()), {
			ok: 'Zum Team hinzugefügt.'
		});
	},
	rechte: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		const on = (k: string) => f.get(k) === 'on';
		const id = await unitId(locals, params.slug);
		return guard(
			() =>
				setMemberRights(
					requirePrincipal(locals),
					id,
					str(f, 'person', 40),
					{
						isPrimary: on('primaer'),
						mayWriteNews: on('neuigkeiten'),
						mayWriteFaqs: on('faqs'),
						mayWriteEvents: on('termine'),
						mayWriteBehindScenes: on('kulissen'),
						mayWriteMedia: on('mediathek'),
						mayWriteSurveys: on('umfragen'),
						// Rollen vergibt die Verwaltung; hier bleibt alles, wie es ist
						verwaltet: on('verwaltet')
					},
					getClientAddress()
				),
			{ ok: 'Rechte gespeichert.' }
		);
	},
	entfernen: async ({ request, locals, params, getClientAddress }) => {
		const person = str(await request.formData(), 'person', 40);
		const id = await unitId(locals, params.slug);
		return guard(() => removeMember(requirePrincipal(locals), id, person, getClientAddress()), {
			ok: 'Aus dem Team entfernt.'
		});
	},
	zneu: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await unitId(locals, params.slug);
		return guard(
			() => createResponsibility(requirePrincipal(locals), id, readResponsibility(f)),
			{ ok: 'Zuständigkeit angelegt.', neu: true },
			{ eintrag: 'neu' }
		);
	},
	zspeichern: async ({ request, locals, params }) => {
		const f = await request.formData();
		const eintrag = str(f, 'id', 40);
		const id = await unitId(locals, params.slug);
		return guard(
			() => updateResponsibility(requirePrincipal(locals), id, eintrag, readResponsibility(f)),
			{ ok: 'Zuständigkeit gespeichert.', eintrag },
			{ eintrag }
		);
	},
	zloeschen: async ({ request, locals, params }) => {
		const eintrag = str(await request.formData(), 'id', 40);
		const id = await unitId(locals, params.slug);
		return guard(() => deleteResponsibility(requirePrincipal(locals), id, eintrag), {
			ok: 'Zuständigkeit gelöscht.'
		});
	},
	zverschieben: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await unitId(locals, params.slug);
		const dir = f.get('richtung') === 'hoch' ? 'hoch' : 'runter';
		return guard(() => moveResponsibility(requirePrincipal(locals), id, str(f, 'id', 40), dir), {});
	},
	geprueft: async ({ locals, params, getClientAddress }) => {
		const id = await unitId(locals, params.slug);
		return guard(() => markReviewed(requirePrincipal(locals), id, getClientAddress()), {
			ok: 'Die Zuständigkeiten gelten als geprüft.'
		});
	}
};
