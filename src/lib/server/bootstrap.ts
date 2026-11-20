/**
 * Erstbefüllung: Gibt es noch keinen Mandanten, legt die Anwendung beim Start
 * den Hauptmandanten mit seinen Domains aus INITIAL_TENANT_* an. Sobald ein
 * Mandant existiert, passiert nichts mehr (Pflege dann unter Verwaltung → Mandanten).
 */
import { sql } from 'drizzle-orm';
import { audit } from './audit.ts';
import { readInitialTenant } from './bootstrap-config.ts';
import { db } from './db/index.ts';
import { tenantDomains, tenants } from './db/schema.ts';

export async function ensureInitialTenant(env = process.env): Promise<void> {
	const initial = readInitialTenant(env);
	if (!initial) return;
	const created = await db.transaction(async (tx) => {
		// Sperre gegen gleichzeitige Starts mehrerer Instanzen
		await tx.execute(sql`select pg_advisory_xact_lock(4711)`);
		const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(tenants);
		if (n > 0) return null;
		const [row] = await tx
			.insert(tenants)
			.values({
				name: initial.name,
				shortName: initial.shortName,
				isMain: true,
				accentColor: initial.accent,
				accentColorDark: initial.accentDark
			})
			.returning({ id: tenants.id });
		await tx
			.insert(tenantDomains)
			.values(initial.domains.map((domain) => ({ domain, tenantId: row.id })));
		return row.id;
	});
	if (created) {
		console.info(`Hauptmandant „${initial.name}“ mit ${initial.domains.join(', ')} angelegt.`);
		await audit({
			category: 'admin',
			action: 'tenant.bootstrap',
			tenantId: created,
			entityType: 'tenant',
			entityId: created,
			details: { domains: initial.domains }
		});
	}
}
