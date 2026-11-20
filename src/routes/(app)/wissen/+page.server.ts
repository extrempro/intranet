import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { listFaqs } from '#lib/server/faqs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	const faqs = await listFaqs(p, {});
	const n = faqs.groups.reduce((s, g) => s + g.items.length, 0);
	return {
		texte: {
			faqs: n ? `${n === 1 ? '1 Frage' : `${n} Fragen`} aus Abteilungen und Hubs` : null
		} as Record<string, string | null>
	};
};
