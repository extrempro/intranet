import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import { getNotify, setNotify } from '#lib/server/notify.ts';
import { TOPICS, type EmailMode } from '#lib/notify.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const moderation = p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
	return {
		einstellung: await getNotify(p.personId),
		mailBereit: await mailConfigured(),
		themen: TOPICS.filter((t) => !t.onlyFor || (t.onlyFor === 'moderation' && moderation)).map(
			(t) => t.key
		)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const topics: Record<string, { bell: boolean; email: boolean }> = {};
		const vorher = await getNotify(p.personId);
		const moderation = p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
		for (const t of TOPICS)
			// Nicht angezeigte Themen behalten ihre bisherige Einstellung
			topics[t.key] =
				t.onlyFor && !(t.onlyFor === 'moderation' && moderation)
					? vorher.topics[t.key]
					: {
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
