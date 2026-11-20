import { error, fail } from '@sveltejs/kit';
import { asc, eq, inArray } from 'drizzle-orm';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { tenants, units } from '#lib/server/db/schema.ts';
import { ROLE_DEFINITIONS, ROLES, unitTypeLabel } from '#lib/roles.ts';
import {
	addGroupMapping,
	listGroupMappings,
	removeGroupMapping,
	UserError
} from '#lib/server/users.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Das dürfen nur System-Admins.');
	const [zuordnungen, mandanten, einheiten] = await Promise.all([
		listGroupMappings(p),
		db.select({ id: tenants.id, name: tenants.name }).from(tenants).orderBy(asc(tenants.name)),
		db
			.select({
				id: units.id,
				name: units.name,
				type: units.type,
				title: units.title,
				tenantName: tenants.name
			})
			.from(units)
			.innerJoin(tenants, eq(tenants.id, units.tenantId))
			.where(inArray(units.type, ['geschaeftsfuehrung', 'stabsstelle', 'abteilung', 'hub']))
			.orderBy(asc(units.name))
	]);
	return {
		zuordnungen,
		mandanten,
		einheiten: einheiten.map((e) => ({
			id: e.id,
			name: e.name,
			type: e.type,
			label: unitTypeLabel(e),
			tenantName: e.tenantName
		})),
		rollen: ROLES.map((role) => ({
			role,
			label: ROLE_DEFINITIONS[role].label,
			scopes: [...ROLE_DEFINITIONS[role].scopes],
			unitTypes: [...(ROLE_DEFINITIONS[role].unitTypes ?? [])]
		}))
	};
};

async function guarded(fn: () => Promise<unknown>) {
	try {
		await fn();
		return { gespeichert: true };
	} catch (err) {
		if (err instanceof UserError) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	hinzufuegen: async ({ request, locals, getClientAddress }) => {
		const f = await request.formData();
		return guarded(() =>
			addGroupMapping(
				requirePrincipal(locals),
				String(f.get('gruppe') ?? ''),
				String(f.get('gruppenname') ?? ''),
				{
					role: String(f.get('rolle') ?? ''),
					scope: String(f.get('bereich') ?? ''),
					scopeId: String(f.get('ziel') ?? '')
				},
				getClientAddress()
			)
		);
	},
	entfernen: async ({ request, locals, getClientAddress }) => {
		const id = String((await request.formData()).get('zuordnung') ?? '');
		return guarded(() => removeGroupMapping(requirePrincipal(locals), id, getClientAddress()));
	}
};
