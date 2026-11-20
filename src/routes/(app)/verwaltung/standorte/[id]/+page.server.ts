import { error, fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	CanteenError,
	getLocationForAdmin,
	inviteOperator,
	setOperatorActive,
	updateLocation
} from '#lib/server/canteen.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	try {
		return {
			standort: await getLocationForAdmin(p, params.id),
			mailBereit: await mailConfigured()
		};
	} catch (err) {
		if (err instanceof CanteenError) error(404, err.message);
		throw err;
	}
};

function wrap<T>(fn: () => Promise<T>) {
	return fn().catch((err) => {
		if (err instanceof CanteenError) return fail(400, { fehler: err.message });
		throw err;
	});
}

export const actions: Actions = {
	speichern: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return wrap(async () => {
			await updateLocation(
				p,
				params.id,
				{
					name: String(f.get('name') ?? ''),
					address: String(f.get('adresse') ?? ''),
					active: f.get('aktiv') === 'on'
				},
				getClientAddress()
			);
			return { gespeichert: true };
		});
	},
	einladen: async ({ request, locals, params, url, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const input = { name: String(f.get('name') ?? ''), email: String(f.get('email') ?? '') };
		return wrap(async () => {
			const r = await inviteOperator(p, params.id, input, url.origin, getClientAddress());
			if (!r.ok) return fail(400, { einladung: input, einladeFehler: r.message });
			return { eingeladen: input.email.trim() };
		});
	},
	sperren: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return wrap(async () => {
			await setOperatorActive(
				p,
				params.id,
				String(f.get('person') ?? ''),
				false,
				getClientAddress()
			);
			return { gesperrt: true };
		});
	},
	freigeben: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return wrap(async () => {
			await setOperatorActive(
				p,
				params.id,
				String(f.get('person') ?? ''),
				true,
				getClientAddress()
			);
			return { freigegeben: true };
		});
	}
};
