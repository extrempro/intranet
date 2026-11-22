import { error, fail } from '@sveltejs/kit';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/audit.ts';
import {
	themaAnlegen,
	ThemaFehler,
	themaLoeschen,
	themaUmbenennen,
	themenMitAnzahl,
	vorschlaege,
	vorschlagEntscheiden
} from '#lib/server/themen.ts';
import type { Actions, PageServerLoad } from './$types';

/** Themen der Mediathek und FAQs (Kap. 8.15): nur System-Admins. */
function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Das dürfen nur System-Admins.');
	return p;
}

const uuid = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '');
	return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};

export const load: PageServerLoad = async ({ locals }) => {
	requireSystemAdmin(locals);
	return { themen: await themenMitAnzahl(), vorschlaege: await vorschlaege() };
};

async function mit(
	locals: App.Locals,
	ip: string,
	action: string,
	fn: () => Promise<string>,
	ok: (name: string) => string,
	id?: string | null
) {
	const p = requireSystemAdmin(locals);
	try {
		const name = await fn();
		await audit({
			category: 'admin',
			action,
			actorId: p.personId,
			entityType: 'topic',
			entityId: id ?? undefined,
			details: { name },
			ip
		});
		return { ergebnis: ok(name) };
	} catch (err) {
		if (err instanceof ThemaFehler) return fail(400, { fehler: err.message, id: id ?? null });
		throw err;
	}
}

export const actions: Actions = {
	anlegen: async ({ request, locals, getClientAddress }) => {
		const fd = await request.formData();
		return mit(
			locals,
			getClientAddress(),
			'topic.create',
			async () => (await themaAnlegen(fd.get('name'))).name,
			(n) => `Thema „${n}“ angelegt.`
		);
	},
	umbenennen: async ({ request, locals, getClientAddress }) => {
		const fd = await request.formData();
		const id = uuid(fd.get('id'));
		if (!id) error(400, 'Ungültiges Thema');
		return mit(
			locals,
			getClientAddress(),
			'topic.rename',
			() => themaUmbenennen(id, fd.get('name')),
			(n) => `Gespeichert. Das Thema heißt jetzt „${n}“.`,
			id
		);
	},
	loeschen: async ({ request, locals, getClientAddress }) => {
		const id = uuid((await request.formData()).get('id'));
		if (!id) error(400, 'Ungültiges Thema');
		return mit(
			locals,
			getClientAddress(),
			'topic.delete',
			() => themaLoeschen(id),
			(n) => `Thema „${n}“ gelöscht.`,
			id
		);
	},
	annehmen: async ({ request, locals, getClientAddress }) => {
		const id = uuid((await request.formData()).get('id'));
		if (!id) error(400, 'Ungültiger Vorschlag');
		return mit(
			locals,
			getClientAddress(),
			'topic.accept',
			() => vorschlagEntscheiden(id, true),
			(n) => `„${n}“ aufgenommen.`,
			id
		);
	},
	ablehnen: async ({ request, locals, getClientAddress }) => {
		const id = uuid((await request.formData()).get('id'));
		if (!id) error(400, 'Ungültiger Vorschlag');
		return mit(
			locals,
			getClientAddress(),
			'topic.reject',
			() => vorschlagEntscheiden(id, false),
			(n) => `Vorschlag „${n}“ abgelehnt.`,
			id
		);
	}
};
