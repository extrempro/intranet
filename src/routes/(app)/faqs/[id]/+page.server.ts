import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readFaqForm } from '#lib/server/faq-form.ts';
import {
	deleteFaq,
	describeFaqAttachments,
	FaqError,
	faqForEdit,
	faqWritableUnits,
	saveFaq
} from '#lib/server/faqs.ts';
import { alleThemen } from '#lib/server/themen.ts';
import type { Actions, PageServerLoad } from './$types';

/** Bearbeiten einer FAQ; nur mit Schreibrecht „FAQs“ für die Einheit. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const faq = await faqForEdit(p, params.id);
	if (!faq) error(404, 'Diese FAQ gibt es nicht oder du darfst sie nicht bearbeiten.');
	return {
		id: faq.id,
		einheiten: await faqWritableUnits(p),
		themen: await alleThemen(),
		werte: {
			unitId: faq.unitId,
			question: faq.question,
			answerHtml: faq.answerHtml,
			attachments: faq.attachments,
			themen: faq.themen
		}
	};
};

export const actions: Actions = {
	speichern: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const input = readFaqForm(await request.formData());
		try {
			const r = await saveFaq(p, params.id, input);
			if (!r.ok)
				return fail(400, {
					werte: {
						unitId: input.unitId,
						question: input.question,
						answerHtml: input.answerHtml,
						attachments: await describeFaqAttachments(p, input.attachmentIds, params.id),
						themen: input.themen ?? []
					},
					fehler: r.errors
				});
		} catch (err) {
			if (err instanceof FaqError) error(404, err.message);
			throw err;
		}
		redirect(303, `/faqs?einheit=${input.unitId}#faq-${params.id}`);
	},
	loeschen: async ({ locals, params }) => {
		const p = requirePrincipal(locals);
		let unitId: string;
		try {
			unitId = await deleteFaq(p, params.id);
		} catch (err) {
			if (err instanceof FaqError) return fail(404, { loeschFehler: err.message });
			throw err;
		}
		redirect(303, `/faqs?einheit=${unitId}`);
	}
};
