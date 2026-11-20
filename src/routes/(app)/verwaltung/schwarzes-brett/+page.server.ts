import { fail } from '@sveltejs/kit';
import { audit } from '#lib/server/audit.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal, requireThat } from '#lib/server/auth/guard.ts';
import {
	addCategory,
	BoardError,
	categories,
	deleteCategory,
	moveCategory,
	renameCategory
} from '#lib/server/board.ts';
import type { Actions, PageServerLoad } from './$types';

/** Kategorien gelten für alle Mandanten: nur System-Admins. */
export const load: PageServerLoad = async ({ locals }) => {
	requireThat(isSystemAdmin(requirePrincipal(locals)));
	return { kategorien: await categories() };
};

function action(name: string, fn: (f: FormData) => Promise<void>): Actions[string] {
	return async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		requireThat(isSystemAdmin(p));
		const f = await request.formData();
		try {
			await fn(f);
		} catch (err) {
			if (err instanceof BoardError) return fail(400, { fehler: err.message });
			throw err;
		}
		await audit({
			category: 'admin',
			action: `board_category.${name}`,
			actorId: p.personId,
			details: { name: String(f.get('name') ?? '') || undefined },
			ip: getClientAddress()
		});
		return { gespeichert: true };
	};
}

export const actions: Actions = {
	anlegen: action('create', (f) => addCategory(String(f.get('name') ?? ''))),
	umbenennen: action('rename', (f) =>
		renameCategory(String(f.get('id') ?? ''), String(f.get('name') ?? ''))
	),
	loeschen: action('delete', (f) => deleteCategory(String(f.get('id') ?? ''))),
	hoch: action('move', (f) => moveCategory(String(f.get('id') ?? ''), -1)),
	runter: action('move', (f) => moveCategory(String(f.get('id') ?? ''), 1))
};
