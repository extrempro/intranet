import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readAgreementForm } from '#lib/server/legal-form.ts';
import {
	deleteAgreement,
	describeAttachments,
	getAgreement,
	LegalError,
	maintainableTenants,
	saveAgreement
} from '#lib/server/legal.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const v = await getAgreement(p, params.id);
	if (!v?.canWrite) error(404, 'Diese Vereinbarung gibt es nicht oder du darfst sie nicht ändern.');
	return {
		id: v.id,
		mandanten: await maintainableTenants(p),
		werte: {
			tenantId: v.tenantId,
			kind: v.kind,
			title: v.title,
			description: v.description ?? '',
			versionDate: v.versionDate,
			validFrom: v.validFrom,
			attachments: v.attachments
		}
	};
};

export const actions: Actions = {
	speichern: async ({ request, locals, params }) => {
		const p = requirePrincipal(locals);
		const { input, tenantId, attachmentIds, announce } = readAgreementForm(
			await request.formData()
		);
		let r;
		try {
			r = await saveAgreement(p, params.id, tenantId, input, attachmentIds, announce);
		} catch (err) {
			if (err instanceof LegalError) error(404, err.message);
			throw err;
		}
		if (!r.ok)
			return fail(400, {
				werte: {
					tenantId,
					...input,
					attachments: await describeAttachments(p, attachmentIds, params.id)
				},
				fehler: r.errors
			});
		redirect(303, `/rechtliches/${r.id}`);
	},
	loeschen: async ({ locals, params }) => {
		try {
			await deleteAgreement(requirePrincipal(locals), params.id);
		} catch (err) {
			if (err instanceof LegalError) error(404, err.message);
			throw err;
		}
		redirect(303, '/rechtliches');
	}
};
