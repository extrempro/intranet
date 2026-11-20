import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { deletePost, getPost, KulissenError, react } from '#lib/server/kulissen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const post = await getPost(requirePrincipal(locals), params.id);
	if (!post) error(404, 'Diesen Beitrag gibt es nicht oder nicht mehr.');
	return { post };
};

export const actions: Actions = {
	reagieren: async ({ request, locals, params }) => {
		const emoji = String((await request.formData()).get('emoji') ?? '');
		try {
			await react(requirePrincipal(locals), params.id, emoji);
		} catch (err) {
			if (err instanceof KulissenError) return fail(404, { fehler: err.message });
			throw err;
		}
		return {};
	},
	loeschen: async ({ locals, params }) => {
		try {
			await deletePost(requirePrincipal(locals), params.id);
		} catch (err) {
			if (err instanceof KulissenError) return fail(404, { fehler: err.message });
			throw err;
		}
		redirect(303, '/hinter-den-kulissen');
	}
};
