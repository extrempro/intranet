import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readFaqForm } from '#lib/server/faq-form.ts';
import { describeFaqAttachments, faqWritableUnits, saveFaq } from '#lib/server/faqs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const einheiten = await faqWritableUnits(p);
	if (einheiten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const gewuenscht = url.searchParams.get('einheit');
	return {
		einheiten,
		werte: {
			unitId: einheiten.find((e) => e.id === gewuenscht)?.id ?? einheiten[0].id,
			question: '',
			answerHtml: '',
			attachments: []
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const input = readFaqForm(await request.formData());
		const r = await saveFaq(p, null, input);
		if (!r.ok) {
			return fail(400, {
				werte: {
					unitId: input.unitId,
					question: input.question,
					answerHtml: input.answerHtml,
					attachments: await describeFaqAttachments(p, input.attachmentIds, null)
				},
				fehler: r.errors
			});
		}
		redirect(303, `/faqs?einheit=${input.unitId}#faq-${r.id}`);
	}
};
