import { error, fail } from '@sveltejs/kit';
import { bestaetigungFehlt } from '#lib/server/auth/bestaetigung.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { readTenantForm } from '#lib/server/tenant-form.ts';
import {
	addAdmin,
	addDomain,
	getTenant,
	removeAdmin,
	removeDomain,
	TenantError,
	updateTenant
} from '#lib/server/tenants.ts';
import { audit } from '#lib/server/audit.ts';
import { deleteImages, MarkeError, saveImages, type MarkenArt } from '#lib/server/marke.ts';
import { brandingFor, forgetBranding } from '#lib/server/tenant-branding.ts';
import type { Actions, PageServerLoad } from './$types';

const SYMBOLE: MarkenArt[] = ['symbol_32', 'symbol_180', 'symbol_192', 'symbol_512'];

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	try {
		return {
			mandant: await getTenant(p, params.id),
			marke: await brandingFor(params.id),
			systemAdmin: isSystemAdmin(p),
			ichId: p.personId
		};
	} catch (err) {
		if (err instanceof TenantError) error(404, err.message);
		throw err;
	}
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { gespeichert: true };
	} catch (err) {
		if (err instanceof TenantError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	bild: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		try {
			await getTenant(p, params.id);
			const f = await request.formData();
			const art = String(f.get('art') ?? '');
			const arten: MarkenArt[] =
				art === 'symbol' ? SYMBOLE : art === 'logo_hell' || art === 'logo_dunkel' ? [art] : [];
			if (arten.length === 0) return fail(400, { fehler: 'Unbekannte Bildart.' });
			const bilder = await Promise.all(
				arten.map(async (a) => {
					const datei = f.get(a);
					if (!(datei instanceof File)) throw new MarkeError('Bitte wähle ein Bild.');
					return { art: a, data: new Uint8Array(await datei.arrayBuffer()) };
				})
			);
			await saveImages(params.id, bilder);
			forgetBranding();
			await audit({
				category: 'admin',
				action: 'tenant.image',
				actorId: p.personId,
				tenantId: params.id,
				entityType: 'tenant',
				entityId: params.id,
				details: { art },
				ip: getClientAddress()
			});
			return { gespeichert: true };
		} catch (err) {
			if (err instanceof TenantError || err instanceof MarkeError)
				return fail(400, { fehler: err.message });
			throw err;
		}
	},
	bildEntfernen: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		try {
			await getTenant(p, params.id);
		} catch (err) {
			if (err instanceof TenantError) return fail(400, { fehler: err.message });
			throw err;
		}
		const art = String((await request.formData()).get('art') ?? '');
		const arten: MarkenArt[] =
			art === 'symbol' ? SYMBOLE : art === 'logo_hell' || art === 'logo_dunkel' ? [art] : [];
		await deleteImages(params.id, arten);
		forgetBranding();
		await audit({
			category: 'admin',
			action: 'tenant.image_remove',
			actorId: p.personId,
			tenantId: params.id,
			entityType: 'tenant',
			entityId: params.id,
			details: { art },
			ip: getClientAddress()
		});
		return { gespeichert: true };
	},
	speichern: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const input = readTenantForm(await request.formData());
		return guarded(() => updateTenant(p, params.id, input, getClientAddress()));
	},
	domainHinzu: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const domain = String((await request.formData()).get('domain') ?? '').slice(0, 260);
		return guarded(() => addDomain(p, params.id, domain, getClientAddress()));
	},
	domainEntfernen: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const domain = String((await request.formData()).get('domain') ?? '').slice(0, 260);
		return guarded(() => removeDomain(p, params.id, domain, getClientAddress()));
	},
	adminHinzu: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const email = String((await request.formData()).get('email') ?? '').slice(0, 320);
		return guarded(() => addAdmin(p, params.id, email, getClientAddress()));
	},
	adminEntfernen: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const person = String((await request.formData()).get('person') ?? '').slice(0, 40);
		return guarded(() => removeAdmin(p, params.id, person, getClientAddress()));
	}
};
