import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import { getNotify, setNotify } from '#lib/server/notify.ts';
import { TOPICS, type EmailMode } from '#lib/notify.ts';
import type { Principal } from '#lib/server/auth/access.ts';
import type { Actions, PageServerLoad } from './$types';

/** Themen nur für bestimmte Aufgaben (Moderation, Pflege einer Einheit) */
function allowed(p: Principal, onlyFor: 'moderation' | 'pflege' | undefined) {
	if (!onlyFor) return true;
	if (onlyFor === 'moderation') return p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
	return p.roles.some((r) => r.role === 'abteilungsverwaltung' || r.role === 'redaktion');
}

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	return {
		einstellung: await getNotify(p.personId),
		mailBereit: await mailConfigured(),
		themen: TOPICS.filter((t) => !t.hidden)
			.filter((t) => allowed(p, t.onlyFor))
			.map((t) => t.key)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const topics: Record<string, { bell: boolean; email: boolean }> = {};
		const vorher = await getNotify(p.personId);
		for (const t of TOPICS)
			// Nicht angezeigte Themen behalten ihre bisherige Einstellung
			topics[t.key] =
				t.hidden || !allowed(p, t.onlyFor)
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
