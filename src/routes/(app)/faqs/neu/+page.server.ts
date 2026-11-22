import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readFaqForm } from '#lib/server/faq-form.ts';
import { describeFaqAttachments, faqWritableUnits, saveFaq } from '#lib/server/faqs.ts';
import { alleThemen } from '#lib/server/themen.ts';
import { entwuerfeListe, entwurfLaden, entwurfLoeschen } from '#lib/server/entwuerfe.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const einheiten = await faqWritableUnits(p);
	if (einheiten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const gewuenscht = url.searchParams.get('einheit');
	const entwurf = await entwurfLaden(p, url.searchParams.get('entwurf'), 'faq');
	const ausEntwurf = entwurf ? readFaqForm(entwurf.form) : null;
	return {
		einheiten,
		themen: await alleThemen(),
		entwurf: entwurf ? { id: entwurf.id, gespeichert: entwurf.gespeichert } : null,
		entwuerfe: entwurf ? [] : await entwuerfeListe(p, 'faq'),
		werte: ausEntwurf
			? {
					unitId: ausEntwurf.unitId,
					question: ausEntwurf.question,
					answerHtml: ausEntwurf.answerHtml,
					attachments: await describeFaqAttachments(p, ausEntwurf.attachmentIds, null),
					themen: ausEntwurf.themen ?? []
				}
			: {
					unitId: einheiten.find((e) => e.id === gewuenscht)?.id ?? einheiten[0].id,
					question: '',
					answerHtml: '',
					attachments: [],
					themen: [] as string[]
				}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const fd = await request.formData();
		const entwurf = String(fd.get('entwurf') ?? '') || null;
		const input = readFaqForm(fd);
		const r = await saveFaq(p, null, input);
		if (!r.ok) {
			return fail(400, {
				werte: {
					unitId: input.unitId,
					question: input.question,
					answerHtml: input.answerHtml,
					attachments: await describeFaqAttachments(p, input.attachmentIds, null),
					themen: input.themen ?? []
				},
				fehler: r.errors,
				entwurf
			});
		}
		await entwurfLoeschen(p, entwurf);
		redirect(303, `/faqs?einheit=${input.unitId}#faq-${r.id}`);
	}
};
