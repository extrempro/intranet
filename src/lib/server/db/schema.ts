import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Erste Tabelle als Ausgangspunkt. Das vollständige Datenmodell
 * (Einheiten, Beiträge, Hubs, Termine …) folgt in Etappe 1, siehe docs/spec.md.
 */
export const tenants = pgTable('tenants', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	shortName: text('short_name').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const tenantDomains = pgTable('tenant_domains', {
	domain: text('domain').primaryKey(),
	tenantId: uuid('tenant_id')
		.notNull()
		.references(() => tenants.id, { onDelete: 'cascade' })
});
