import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readAgreementForm } from '#lib/server/legal-form.ts';
import { describeAttachments, maintainableTenants, saveAgreement } from '#lib/server/legal.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const mandanten = await maintainableTenants(p);
	if (mandanten.length === 0) error(403, 'Dafür fehlt dir das Recht.');
	const gewuenscht = url.searchParams.get('mandant');
	return {
		mandanten,
		werte: {
			tenantId:
				mandanten.find((m) => m.id === gewuenscht)?.id ??
				mandanten.find((m) => m.id === p.tenantId)?.id ??
				mandanten[0].id,
			kind: 'betrieb',
			title: '',
			description: '',
			versionDate: new Date().toISOString().slice(0, 10),
			validFrom: '',
			attachments: [] as { id: string; name: string; size: number }[]
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const { input, tenantId, attachmentIds } = readAgreementForm(await request.formData());
		const r = await saveAgreement(p, null, tenantId, input, attachmentIds, true);
		if (!r.ok)
			return fail(400, {
				werte: {
					tenantId,
					...input,
					attachments: await describeAttachments(p, attachmentIds, null)
				},
				fehler: r.errors
			});
		redirect(303, `/rechtliches/${r.id}`);
	}
};
