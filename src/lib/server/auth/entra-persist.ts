import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { entraGroupRoles, persons, roleAssignments, tenantDomains } from '../db/schema.ts';
import type { DerivedRole, GroupRoleMapping } from './entra-login.ts';

/** Domains und Gruppen-Zuordnungen für resolveEntraLogin. */
export async function loadLoginContext(): Promise<{
	domains: Record<string, string>;
	mappings: GroupRoleMapping[];
}> {
	const [domainRows, mappingRows] = await Promise.all([
		db.select().from(tenantDomains),
		db
			.select({
				groupId: entraGroupRoles.groupId,
				role: entraGroupRoles.role,
				scope: entraGroupRoles.scope,
				scopeTenantId: entraGroupRoles.scopeTenantId,
				scopeUnitId: entraGroupRoles.scopeUnitId
			})
			.from(entraGroupRoles)
	]);
	return {
		domains: Object.fromEntries(domainRows.map((d) => [d.domain, d.tenantId])),
		mappings: mappingRows
	};
}

export type UpsertResult =
	| { ok: true; personId: string; created: boolean }
	| { ok: false; reason: 'account_disabled' | 'local_conflict' };

/**
 * Legt die Person an oder gleicht sie ab (Name, E-Mail, Mandant) und ersetzt
 * ihre aus Entra stammenden Rollen. Von Hand vergebene Rollen bleiben.
 */
export async function upsertEntraPerson(input: {
	oid: string;
	email: string;
	displayName: string;
	givenName?: string | null;
	tenantId: string;
	roles: DerivedRole[];
	/** Vorab angelegt (Team hinzugefügt), noch nicht angemeldet */
	vorab?: boolean;
}): Promise<UpsertResult> {
	return db.transaction(async (tx) => {
		const [byOid] = await tx.select().from(persons).where(eq(persons.entraOid, input.oid));
		const [byEmail] = byOid
			? [undefined]
			: await tx
					.select()
					.from(persons)
					.where(sql`lower(${persons.email}) = lower(${input.email})`);

		// Gleiche E-Mail, aber lokales oder anderes Entra-Konto: nicht still zusammenführen.
		if (byEmail) return { ok: false, reason: 'local_conflict' } as const;

		let personId: string;
		let created = false;
		if (byOid) {
			// Von der Verwaltung gesperrt: bleibt gesperrt. Vom Abgleich gesperrt
			// (Kap. 4.1): Die Anmeldung zeigt, dass Entra das Konto wieder zulässt.
			if (byOid.status === 'disabled' && byOid.disabledBy !== 'entra')
				return { ok: false, reason: 'account_disabled' } as const;
			personId = byOid.id;
			await tx
				.update(persons)
				.set({
					email: input.email,
					displayName: input.displayName,
					givenName: input.givenName ?? null,
					tenantId: input.tenantId,
					status: 'active',
					disabledAt: null,
					disabledBy: null,
					lastLoginAt: new Date()
				})
				.where(eq(persons.id, personId));
		} else {
			const [row] = await tx
				.insert(persons)
				.values({
					tenantId: input.tenantId,
					email: input.email,
					displayName: input.displayName,
					givenName: input.givenName ?? null,
					authSource: 'entra',
					entraOid: input.oid,
					status: 'active',
					lastLoginAt: input.vorab ? null : new Date()
				})
				.returning({ id: persons.id });
			personId = row.id;
			created = true;
		}

		await replaceEntraRoles(tx, personId, input.roles);
		return { ok: true, personId, created } as const;
	});
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ersetzt die aus Entra stammenden Rollen; von Hand vergebene bleiben. */
export async function replaceEntraRoles(tx: Tx, personId: string, roles: DerivedRole[]) {
	await tx
		.delete(roleAssignments)
		.where(and(eq(roleAssignments.personId, personId), eq(roleAssignments.source, 'entra')));
	if (roles.length > 0) {
		await tx.insert(roleAssignments).values(
			roles.map((r) => ({
				personId,
				role: r.role,
				scope: r.scope,
				scopeTenantId: r.scopeTenantId,
				scopeUnitId: r.scopeUnitId,
				source: 'entra' as const,
				entraGroupId: r.groupId
			}))
		);
	}
}
