import { error, fail } from '@sveltejs/kit';
import { isSystemAdmin, type Principal } from './auth/access.ts';
import { requirePrincipal } from './auth/guard.ts';
import { audit } from './audit.ts';
import {
	themaAnlegen,
	ThemaFehler,
	themaLoeschen,
	themaUmbenennen,
	themenMitAnzahl,
	vorschlaege,
	vorschlagEntscheiden
} from './themen.ts';
import type { Actions } from '@sveltejs/kit';

/**
 * Themen der Mediathek und FAQs pflegen (Kap. 8.15): System-Admins in der
 * Verwaltung und die Redaktion für alle Mandanten (Kap. 10). Die Liste gilt
 * für alle Mandanten, deshalb nicht die Redaktion eines einzelnen Mandanten.
 */
export function darfThemenPflegen(p: Principal): boolean {
	return isSystemAdmin(p) || p.roles.some((r) => r.role === 'redaktion' && r.scope === 'all');
}

function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!darfThemenPflegen(p)) error(403, 'Dafür fehlt dir das Recht.');
	return p;
}

const uuid = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '');
	return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};

export async function themenLaden(locals: App.Locals) {
	requireSystemAdmin(locals);
	return { themen: await themenMitAnzahl(), vorschlaege: await vorschlaege() };
}

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

export const themenActions = {
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
} satisfies Actions;
