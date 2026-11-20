import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import { getNotify, setNotify } from '#lib/server/notify.ts';
import { TOPICS, type EmailMode } from '#lib/notify.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	einstellung: await getNotify(requirePrincipal(locals).personId),
	mailBereit: await mailConfigured()
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const topics: Record<string, { bell: boolean; email: boolean }> = {};
		for (const t of TOPICS)
			topics[t.key] = {
				bell: f.get(`${t.key}_glocke`) === 'on',
				email: f.get(`${t.key}_mail`) === 'on'
			};
		await setNotify(p.personId, {
			topics,
			emailMode: String(f.get('modus') ?? 'taeglich') as EmailMode
		});
		return { gespeichert: true };
	}
};
