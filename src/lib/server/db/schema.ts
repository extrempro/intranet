/**
 * Datenmodell Etappe 1 (docs/spec.md, Kap. 3–5, 14–16).
 *
 * Grundsätze:
 * - Jede Person und jede Einheit gehört genau einem Mandanten.
 *   „Zentral“ heißt: gehört zum Hauptmandanten und ist für alle zuständig.
 * - Rollen hängen mit Geltungsbereich an der Person (role_assignments),
 *   delegierte Schreibrechte am Team-Eintrag (unit_members).
 * - Keine Inhalte von Beiträgen im Protokoll, IP-Adressen nur gekürzt.
 */
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	customType,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import type { OpeningDay } from '../../canteen';
import type { HomeLayout } from '../../home';
import type { HubLayout } from '../../hubs';
import type { NotifySettings } from '../../notify';
import { ROLES } from '../../roles';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Mandanten
// ---------------------------------------------------------------------------

export const tenants = pgTable(
	'tenants',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		shortName: text('short_name').notNull().unique(),
		/** Genau ein Mandant ist Hauptmandant (zentrale Einheiten gehören zu ihm). */
		isMain: boolean('is_main').notNull().default(false),
		/** Akzentfarbe als Hex-Wert, z. B. #0F6E56. Logo folgt mit der Dateiablage. */
		accentColor: text('accent_color'),
		/** Hellere Variante der Akzentfarbe für die dunkle Darstellung. */
		accentColorDark: text('accent_color_dark'),
		/** Startseite für neue Personen (Kap. 3.1, 7): Reihenfolge und Sichtbarkeit der Karten. */
		homeDefault: jsonb('home_default').$type<HomeLayout>(),
		/** Favoriten für neue Personen (Schlüssel wie in favorites.key); null = Standard */
		defaultFavorites: jsonb('default_favorites').$type<string[]>(),
		/** Leitung des Mandanten (Kap. 3.1), jeweils eine Einheit vom Typ Geschäftsführung. */
		artisticLeadUnitId: uuid('artistic_lead_unit_id').references((): AnyPgColumn => units.id, {
			onDelete: 'set null'
		}),
		commercialLeadUnitId: uuid('commercial_lead_unit_id').references((): AnyPgColumn => units.id, {
			onDelete: 'set null'
		}),
		/** KBB des Mandanten (eine Abteilung). */
		kbbUnitId: uuid('kbb_unit_id').references((): AnyPgColumn => units.id, {
			onDelete: 'set null'
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('tenants_one_main')
			.on(t.isMain)
			.where(sql`${t.isMain}`),
		check('tenants_accent_color_hex', sql`${t.accentColor} ~ '^#[0-9a-fA-F]{6}$'`),
		check('tenants_accent_color_dark_hex', sql`${t.accentColorDark} ~ '^#[0-9a-fA-F]{6}$'`)
	]
);

/** E-Mail-Domains je Mandant; daraus wird der Mandant einer Person abgeleitet. */
export const tenantDomains = pgTable(
	'tenant_domains',
	{
		domain: text('domain').primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' })
	},
	(t) => [
		index('tenant_domains_tenant').on(t.tenantId),
		check('tenant_domains_lowercase', sql`${t.domain} = lower(${t.domain})`)
	]
);

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

export const unitType = pgEnum('unit_type', [
	'geschaeftsfuehrung',
	'stabsstelle',
	'abteilung',
	'hub'
]);

export const units = pgTable(
	'units',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Besitzender Mandant. Bei zentralen Einheiten der Hauptmandant. */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'restrict' }),
		type: unitType('type').notNull(),
		name: text('name').notNull(),
		/** Freitext statt Typbezeichnung, nur für Geschäftsführung und Stabsstelle (Kap. 3.2). */
		title: text('title'),
		/** Teil der Adresse, z. B. /organisation/abteilungen/it */
		slug: text('slug').notNull().unique(),
		/** Für alle Mandanten zuständig. Stabsstellen immer. */
		isCentral: boolean('is_central').notNull().default(false),
		/** Erscheint nicht in Listen und Suche. */
		hidden: boolean('hidden').notNull().default(false),
		leadPersonId: uuid('lead_person_id').references((): AnyPgColumn => persons.id, {
			onDelete: 'set null'
		}),
		secondLeadPersonId: uuid('second_lead_person_id').references((): AnyPgColumn => persons.id, {
			onDelete: 'set null'
		}),
		deputyPersonId: uuid('deputy_person_id').references((): AnyPgColumn => persons.id, {
			onDelete: 'set null'
		}),
		/** Recht „Dringend“. null = Standard nach Typ (Kap. 8.2). */
		mayPostUrgent: boolean('may_post_urgent'),
		/** Termine eintragen. null = Regel aus der Verwaltung (Kap. 8.8). */
		mayCreateEvents: boolean('may_create_events'),
		/** „Hinter den Kulissen“ für die Einheit freigeschaltet (Kap. 8.4) */
		behindScenes: boolean('behind_scenes').notNull().default(false),
		// --- Nur Hubs (Kap. 8.12) ---
		/** Über uns */
		about: text('about'),
		/** Hinweis oben auf der Hub-Seite */
		notice: text('notice'),
		/** Pflicht-Abo: alle im Zuständigkeitsbereich, Glocke gesperrt */
		mandatorySubscription: boolean('mandatory_subscription').notNull().default(false),
		/** Ruhen (Hub-Team): keine neuen Beiträge */
		restingSince: timestamp('resting_since', { withTimezone: true }),
		/** Archiviert (Verwaltung): nirgends mehr sichtbar, Löschung nach Frist */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		/** Aufbau der Hub-Seite: Abschnitte in Reihenfolge, ausgeblendete fehlen */
		pageLayout: jsonb('page_layout').$type<HubLayout>(),
		// --- Zuständigkeiten (Kap. 8.11) ---
		/** Zuletzt „Alles geprüft“ (oder erste Zuständigkeit angelegt) */
		responsibilitiesCheckedAt: timestamp('responsibilities_checked_at', { withTimezone: true }),
		/** Prüf-Erinnerung verschickt (nur einmal je Prüfzeitraum) */
		reviewRemindedAt: timestamp('review_reminded_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('units_tenant').on(t.tenantId),
		check(
			'units_title_only_lead_or_staff',
			sql`${t.title} is null or ${t.type} in ('geschaeftsfuehrung', 'stabsstelle')`
		),
		check('units_staff_is_central', sql`${t.type} <> 'stabsstelle' or ${t.isCentral}`),
		check('units_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
	]
);

/**
 * Team einer Einheit samt delegierter Schreibrechte (Kap. 5.2).
 * Die Obergrenze (Standard 10 Personen mit Schreibrecht) prüft die Anwendung.
 */
export const unitMembers = pgTable(
	'unit_members',
	{
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		/** Eigene Abteilung der Person (für „Meine“ und „Nur mein Team“). */
		isPrimary: boolean('is_primary').notNull().default(false),
		mayWriteNews: boolean('may_write_news').notNull().default(false),
		mayWriteFaqs: boolean('may_write_faqs').notNull().default(false),
		mayWriteEvents: boolean('may_write_events').notNull().default(false),
		mayWriteBehindScenes: boolean('may_write_behind_scenes').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.unitId, t.personId] }),
		index('unit_members_person').on(t.personId),
		uniqueIndex('unit_members_one_primary')
			.on(t.personId)
			.where(sql`${t.isPrimary}`)
	]
);

// ---------------------------------------------------------------------------
// Personen
// ---------------------------------------------------------------------------

export const authSource = pgEnum('auth_source', ['entra', 'local']);
export const personStatus = pgEnum('person_status', ['invited', 'active', 'disabled']);
export const mobileVisibility = pgEnum('mobile_visibility', ['all', 'team', 'nobody']);

export const persons = pgTable(
	'persons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Immer aus der Domain der E-Mail-Adresse abgeleitet (Kap. 3.1). */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'restrict' }),
		email: text('email').notNull(),
		displayName: text('display_name').notNull(),
		authSource: authSource('auth_source').notNull(),
		/** Object-ID in Entra, nur bei Entra-Konten. */
		entraOid: text('entra_oid').unique(),
		status: personStatus('status').notNull().default('active'),
		disabledAt: timestamp('disabled_at', { withTimezone: true }),
		/** Wer gesperrt hat: „entra“ (Abgleich) gibt Entra wieder frei, sonst nur die Verwaltung. */
		disabledBy: text('disabled_by', { enum: ['verwaltung', 'entra'] }),
		// Selbst gepflegte Kontaktdaten (Kap. 8.13), keine Übernahme aus Entra
		position: text('position'),
		phone: text('phone'),
		mobile: text('mobile'),
		mobileVisibility: mobileVisibility('mobile_visibility').notNull().default('team'),
		room: text('room'),
		/** Profilfoto (freiwillig, verschlüsselt, ohne Metadaten; Kap. 8.13) */
		photoFileId: uuid('photo_file_id').references((): AnyPgColumn => files.id, {
			onDelete: 'set null'
		}),
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('persons_email').on(sql`lower(${t.email})`),
		index('persons_tenant').on(t.tenantId),
		check(
			'persons_entra_oid_matches_source',
			sql`(${t.authSource} = 'entra') = (${t.entraOid} is not null)`
		),
		check('persons_disabled_at', sql`(${t.status} = 'disabled') = (${t.disabledAt} is not null)`)
	]
);

/** Persönliche Einstellungen, gelten für das Konto auf allen Geräten. */
export const personPreferences = pgTable('person_preferences', {
	personId: uuid('person_id')
		.primaryKey()
		.references(() => persons.id, { onDelete: 'cascade' }),
	theme: text('theme', { enum: ['auto', 'hell', 'dunkel'] })
		.notNull()
		.default('auto'),
	/** null = Standard des Mandanten. */
	homeLayout: jsonb('home_layout').$type<HomeLayout>(),
	/** Kalender „Aus: …“: weitere Mandanten (der eigene ist immer dabei). */
	calendarTenants: jsonb('calendar_tenants').$type<string[]>(),
	/** Benachrichtigungen (Kap. 11); null = Voreinstellungen */
	notify: jsonb('notify').$type<NotifySettings>(),
	/** Schwarzes Brett „Anzeigen aus: …“ (weitere Mandanten) */
	boardTenants: jsonb('board_tenants').$type<string[]>(),
	/** Hinter den Kulissen „Aus: …“ (weitere Mandanten) */
	behindTenants: jsonb('behind_tenants').$type<string[]>(),
	/** Gesehene Führung und Einführungen (Kap. 13), z. B. „fuehrung“, „seite:kalender“ */
	helpSeen: jsonb('help_seen').$type<string[]>(),
	updatedAt: updatedAt()
});

/**
 * Favoriten der Startseite (Kap. 7), höchstens 8. Gespeichert wird nur ein
 * Schlüssel aus der Liste bekannter Ziele (src/lib/server/favorites.ts),
 * nie eine freie Adresse.
 */
export const favorites = pgTable(
	'favorites',
	{
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		position: integer('position').notNull(),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.personId, t.key] })]
);

// ---------------------------------------------------------------------------
// Rollen
// ---------------------------------------------------------------------------

/** Liste und erlaubte Geltungsbereiche in src/lib/roles.ts. „betreiber“ folgt mit den Standorten. */
export const roleName = pgEnum('role_name', ROLES);

/** Geltungsbereich: alle Mandanten, ein Mandant oder eine Einheit. */
export const roleScope = pgEnum('role_scope', ['all', 'tenant', 'unit']);

export const roleSource = pgEnum('role_source', ['manual', 'entra']);

export const roleAssignments = pgTable(
	'role_assignments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		role: roleName('role').notNull(),
		scope: roleScope('scope').notNull(),
		scopeTenantId: uuid('scope_tenant_id').references(() => tenants.id, {
			onDelete: 'cascade'
		}),
		scopeUnitId: uuid('scope_unit_id').references(() => units.id, { onDelete: 'cascade' }),
		/** Von Hand vergeben oder aus einer Entra-Gruppe abgeleitet (beim Abgleich ersetzt). */
		source: roleSource('source').notNull().default('manual'),
		entraGroupId: text('entra_group_id'),
		createdAt: createdAt(),
		createdBy: uuid('created_by').references(() => persons.id, { onDelete: 'set null' })
	},
	(t) => [
		index('role_assignments_person').on(t.personId),
		unique('role_assignments_unique')
			.on(t.personId, t.role, t.scope, t.scopeTenantId, t.scopeUnitId, t.source)
			.nullsNotDistinct(),
		check(
			'role_assignments_scope_columns',
			sql`(${t.scope} = 'all' and ${t.scopeTenantId} is null and ${t.scopeUnitId} is null)
			or (${t.scope} = 'tenant' and ${t.scopeTenantId} is not null and ${t.scopeUnitId} is null)
			or (${t.scope} = 'unit' and ${t.scopeUnitId} is not null and ${t.scopeTenantId} is null)`
		),
		check(
			'role_assignments_entra_group',
			sql`(${t.source} = 'entra') = (${t.entraGroupId} is not null)`
		)
	]
);

/**
 * Zuordnung Entra-Gruppe → Rolle mit Geltungsbereich (Kap. 4.1), z. B.
 * IT-GRP-HSO-INTRANET-REDAKTION → Redaktion · alle Mandanten.
 * Wird bei jeder Anmeldung angewendet; die daraus entstandenen Rollen
 * (source = 'entra') werden dabei vollständig ersetzt.
 */
export const entraGroupRoles = pgTable(
	'entra_group_roles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		groupId: text('group_id').notNull(),
		/** Anzeigename der Gruppe, nur zur Orientierung in der Verwaltung. */
		groupName: text('group_name'),
		role: roleName('role').notNull(),
		scope: roleScope('scope').notNull(),
		scopeTenantId: uuid('scope_tenant_id').references(() => tenants.id, {
			onDelete: 'cascade'
		}),
		scopeUnitId: uuid('scope_unit_id').references(() => units.id, { onDelete: 'cascade' }),
		createdAt: createdAt()
	},
	(t) => [
		index('entra_group_roles_group').on(t.groupId),
		unique('entra_group_roles_unique')
			.on(t.groupId, t.role, t.scope, t.scopeTenantId, t.scopeUnitId)
			.nullsNotDistinct(),
		check(
			'entra_group_roles_scope_columns',
			sql`(${t.scope} = 'all' and ${t.scopeTenantId} is null and ${t.scopeUnitId} is null)
			or (${t.scope} = 'tenant' and ${t.scopeTenantId} is not null and ${t.scopeUnitId} is null)
			or (${t.scope} = 'unit' and ${t.scopeUnitId} is not null and ${t.scopeTenantId} is null)`
		)
	]
);

// ---------------------------------------------------------------------------
// Sitzungen
// ---------------------------------------------------------------------------

export const sessions = pgTable(
	'sessions',
	{
		/** SHA-256 des Sitzungstokens (hex). Das Token selbst steht nur im Cookie. */
		id: text('id').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		authMethod: authSource('auth_method').notNull(),
		createdAt: createdAt(),
		lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
		/** Absolute Obergrenze, unabhängig von Aktivität. */
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		/** Für die Liste „Sitzungen“ im Konto. */
		userAgent: text('user_agent'),
		/** Gekürzte IP (IPv4 /24, IPv6 /48). */
		ipPrefix: text('ip_prefix')
	},
	(t) => [index('sessions_person').on(t.personId), index('sessions_expires').on(t.expiresAt)]
);

// ---------------------------------------------------------------------------
// Neuigkeiten (Kap. 8.1, 8.2)
// ---------------------------------------------------------------------------

export const news = pgTable(
	'news',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Absender ist immer die Einheit, nie die Person (Kap. 5.2). */
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		/** Mandant der Einheit (für RLS und Auswertung). */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		/** Bereinigtes HTML aus dem Editor. */
		bodyHtml: text('body_html').notNull(),
		/** Reiner Text für Suche und Vorschau. */
		bodyText: text('body_text').notNull(),
		/** Freigabe: vorher nur für Schreibende der Einheit und die Redaktion sichtbar. */
		publishAt: timestamp('publish_at', { withTimezone: true }).notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		/** Für alle Mandanten, auch künftige; sonst die Liste in news_tenants. */
		allTenants: boolean('all_tenants').notNull().default(false),
		pinnedUntil: timestamp('pinned_until', { withTimezone: true }),
		/** Von der Redaktion angeheftet (eigene Obergrenze). */
		pinnedByEditorial: boolean('pinned_by_editorial').notNull().default(false),
		urgentUntil: timestamp('urgent_until', { withTimezone: true }),
		/** Kurztext für das rote Banner. */
		urgentText: text('urgent_text'),
		/** Nur intern protokolliert, nie angezeigt. */
		createdBy: uuid('created_by').references(() => persons.id, { onDelete: 'set null' }),
		updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' }),
		/** news = Neuigkeiten und Hubs; kulissen = Hinter den Kulissen (Kap. 8.4) */
		channel: text('channel', { enum: ['news', 'kulissen'] })
			.notNull()
			.default('news'),
		/** Hinter den Kulissen: Einwilligung der Abgebildeten bestätigt */
		consentAt: timestamp('consent_at', { withTimezone: true }),
		/** Benachrichtigt beim Veröffentlichen (Kap. 11); dringend ggf. später nachgeholt */
		notifiedAt: timestamp('notified_at', { withTimezone: true }),
		notifiedUrgent: boolean('notified_urgent').notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('news_publish').on(t.publishAt),
		index('news_unit').on(t.unitId),
		check('news_urgent_text', sql`(${t.urgentUntil} is null) = (${t.urgentText} is null)`),
		check(
			'news_expiry_after_urgent',
			sql`${t.expiresAt} is null or ${t.urgentUntil} is null or ${t.expiresAt} >= ${t.urgentUntil}`
		)
	]
);

export const newsTenants = pgTable(
	'news_tenants',
	{
		newsId: uuid('news_id')
			.notNull()
			.references(() => news.id, { onDelete: 'cascade' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.newsId, t.tenantId] }),
		index('news_tenants_tenant').on(t.tenantId)
	]
);

/** Eine Reaktion je Person und Beitrag; angezeigt wird nur die Anzahl (Kap. 8.1). */
export const newsReactions = pgTable(
	'news_reactions',
	{
		newsId: uuid('news_id')
			.notNull()
			.references(() => news.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		emoji: text('emoji').notNull()
	},
	(t) => [primaryKey({ columns: [t.newsId, t.personId] })]
);

/** „Gelesen, zuklappen“ beim roten Banner, je Person. */
export const urgentDismissals = pgTable(
	'urgent_dismissals',
	{
		newsId: uuid('news_id')
			.notNull()
			.references(() => news.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.newsId, t.personId] })]
);

// ---------------------------------------------------------------------------
// Dateien (Kap. 1.4, 15, 16)
// ---------------------------------------------------------------------------

/**
 * Verschlüsselt im Volume FILES_DIR abgelegte Dateien. Der Dateischlüssel liegt
 * nur hier (mit ENCRYPTION_KEY geschützt); wird die Zeile gelöscht, ist die
 * Datei unlesbar. Ohne Verknüpfung (z. B. news_attachments) wird eine Datei
 * nach 24 Stunden gelöscht.
 */
export const files = pgTable('files', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	mime: text('mime').notNull(),
	kind: text('kind').notNull(),
	size: integer('size').notNull(),
	keyEnc: text('key_enc').notNull(),
	createdBy: uuid('created_by').references(() => persons.id, { onDelete: 'set null' }),
	createdAt: createdAt()
});

export const newsAttachments = pgTable(
	'news_attachments',
	{
		newsId: uuid('news_id')
			.notNull()
			.references(() => news.id, { onDelete: 'cascade' }),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'cascade' }),
		position: integer('position').notNull()
	},
	(t) => [primaryKey({ columns: [t.newsId, t.fileId] })]
);

// ---------------------------------------------------------------------------
// Pläne des KBB und Organigramm (Kap. 3.3, 8.6)
// ---------------------------------------------------------------------------

/** Wochen- und Monatspläne je KBB als PDF; für alle Angemeldeten sichtbar. */
export const plans = pgTable(
	'plans',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Das KBB (Einheit, die bei ihrem Mandanten als KBB eingetragen ist). */
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		validFrom: date('valid_from').notNull(),
		validUntil: date('valid_until').notNull(),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'restrict' }),
		uploadedBy: uuid('uploaded_by').references(() => persons.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('plans_unit_from').on(t.unitId, t.validFrom),
		check('plans_valid_range', sql`${t.validUntil} >= ${t.validFrom}`)
	]
);

/** Ein Organigramm für alle Mandanten; neue Fassung ersetzt die alte. */
export const orgChart = pgTable(
	'org_chart',
	{
		id: integer('id').primaryKey().default(1),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'restrict' }),
		/** Stand als Monat, z. B. 2026-11 */
		stand: text('stand').notNull(),
		updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' }),
		updatedAt: updatedAt()
	},
	(t) => [
		check('org_chart_singleton', sql`${t.id} = 1`),
		check('org_chart_stand', sql`${t.stand} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`)
	]
);

// ---------------------------------------------------------------------------
// Lokale Konten (Kap. 4.2)
// ---------------------------------------------------------------------------

const bytea = customType<{ data: Uint8Array<ArrayBuffer>; driverData: Buffer }>({
	dataType: () => 'bytea',
	toDriver: (v) => Buffer.from(v),
	fromDriver: (v) => new Uint8Array(v)
});

export const localCredentials = pgTable('local_credentials', {
	personId: uuid('person_id')
		.primaryKey()
		.references(() => persons.id, { onDelete: 'cascade' }),
	/** Argon2id. null, solange die Einladung nicht angenommen ist. */
	passwordHash: text('password_hash'),
	/** TOTP-Schlüssel, mit ENCRYPTION_KEY verschlüsselt (AES-256-GCM). */
	totpSecretEnc: text('totp_secret_enc'),
	totpConfirmedAt: timestamp('totp_confirmed_at', { withTimezone: true }),
	/** Letzter angenommener TOTP-Zeitschritt, damit ein Code nur einmal gilt. */
	totpLastStep: integer('totp_last_step'),
	failedAttempts: integer('failed_attempts').notNull().default(0),
	lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
	passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
	updatedAt: updatedAt()
});

export const passkeys = pgTable(
	'passkeys',
	{
		/** Credential-ID (base64url). */
		id: text('id').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		publicKey: bytea('public_key').notNull(),
		counter: integer('counter').notNull().default(0),
		transports: text('transports').array(),
		name: text('name').notNull(),
		createdAt: createdAt(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true })
	},
	(t) => [index('passkeys_person').on(t.personId)]
);

/** Einmalcodes, nur als SHA-256 gespeichert (hohe Zufälligkeit, kein Argon2 nötig). */
export const recoveryCodes = pgTable(
	'recovery_codes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		codeHash: text('code_hash').notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [index('recovery_codes_person').on(t.personId)]
);

/** Links „Passwort vergessen“ (Kap. 4.2): nur der Hash, einmalig, kurz gültig. */
export const passwordResets = pgTable(
	'password_resets',
	{
		tokenHash: text('token_hash').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [index('password_resets_person').on(t.personId, t.createdAt)]
);

export const invitations = pgTable(
	'invitations',
	{
		/** SHA-256 des Tokens aus dem Link. */
		tokenHash: text('token_hash').primaryKey(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: createdAt(),
		createdBy: uuid('created_by').references(() => persons.id, { onDelete: 'set null' })
	},
	(t) => [index('invitations_person').on(t.personId)]
);

/**
 * Halbfertige Anmeldung: Passwort ist geprüft, zweiter Faktor (oder dessen
 * Einrichtung) steht noch aus. Im Cookie steht das Token, hier sein Hash.
 * Hält auch die WebAuthn-Challenge.
 */
export const pendingLogins = pgTable('pending_logins', {
	id: text('id').primaryKey(),
	personId: uuid('person_id')
		.notNull()
		.references(() => persons.id, { onDelete: 'cascade' }),
	/** mfa = Code/Passkey eingeben, setup = zweiten Faktor erst einrichten. */
	purpose: text('purpose', { enum: ['mfa', 'setup'] }).notNull(),
	challenge: text('challenge'),
	/** Noch nicht bestätigter TOTP-Schlüssel während der Einrichtung (verschlüsselt). */
	pendingTotpEnc: text('pending_totp_enc'),
	/** Wiederherstellungscodes wurden gezeigt, Anmeldung kann abgeschlossen werden. */
	setupDone: boolean('setup_done').notNull().default(false),
	ziel: text('ziel').notNull().default('/'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: createdAt()
});

// ---------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------

/**
 * admin: Änderungen in der Verwaltung (Löschfrist Standard 1 Jahr).
 * security: Anmeldungen, Fehlversuche, HIBP-Ausfälle usw. (Standard 30 Tage).
 */
export const auditCategory = pgEnum('audit_category', ['admin', 'security']);

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
		category: auditCategory('category').notNull(),
		/** z. B. „login.success“, „unit.update“. */
		action: text('action').notNull(),
		actorId: uuid('actor_id').references(() => persons.id, { onDelete: 'set null' }),
		tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
		entityType: text('entity_type'),
		entityId: text('entity_id'),
		/** Geänderte Felder o. Ä., nie Inhalte von Beiträgen oder Geheimnisse. */
		details: jsonb('details').$type<Record<string, unknown>>(),
		ipPrefix: text('ip_prefix')
	},
	(t) => [
		index('audit_log_category_at').on(t.category, t.at),
		index('audit_log_actor').on(t.actorId)
	]
);

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

/** In der Verwaltung einstellbare Werte; fehlt ein Schlüssel, gilt der Standard im Code. */
export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').notNull(),
	updatedAt: updatedAt(),
	updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' })
});

// ---------------------------------------------------------------------------
// FAQs (Kap. 8.9)
// ---------------------------------------------------------------------------

/** Fragen und Antworten je Einheit; Schreibrecht „FAQs“ (Kap. 5.2). */
export const faqs = pgTable(
	'faqs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		question: text('question').notNull(),
		/** Bereinigtes HTML (src/lib/server/html.ts) */
		answerHtml: text('answer_html').notNull(),
		/** Reiner Text für die Suche */
		answerText: text('answer_text').notNull(),
		position: integer('position').notNull().default(0),
		updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('faqs_unit_position').on(t.unitId, t.position)]
);

export const faqAttachments = pgTable(
	'faq_attachments',
	{
		faqId: uuid('faq_id')
			.notNull()
			.references(() => faqs.id, { onDelete: 'cascade' }),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'cascade' }),
		position: integer('position').notNull()
	},
	(t) => [primaryKey({ columns: [t.faqId, t.fileId] })]
);

// ---------------------------------------------------------------------------
// Speiseplan und Standorte (Kap. 4.3, 8.7)
// ---------------------------------------------------------------------------

/** Kantinen-Standort. Name und Adresse pflegt die Verwaltung, den Rest der Betreiber. */
export const locations = pgTable(
	'locations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'restrict' }),
		name: text('name').notNull(),
		address: text('address'),
		active: boolean('active').notNull().default(true),
		hours: jsonb('hours').$type<OpeningDay[]>().notNull(),
		/** Lage in der Kantine bzw. Zugang */
		place: text('place'),
		note: text('note'),
		contact: text('contact'),
		/** „Heute geschlossen“: gilt nur an diesem Tag (Berlin) */
		closedOn: date('closed_on'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('locations_tenant').on(t.tenantId)]
);

/** Betreiber-Konten (lokal), je Konto genau ein Standort. */
export const locationOperators = pgTable('location_operators', {
	personId: uuid('person_id')
		.primaryKey()
		.references(() => persons.id, { onDelete: 'cascade' }),
	locationId: uuid('location_id')
		.notNull()
		.references(() => locations.id, { onDelete: 'cascade' }),
	createdAt: createdAt()
});

export const locationClosures = pgTable(
	'location_closures',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' }),
		fromDate: date('from_date').notNull(),
		untilDate: date('until_date').notNull(),
		reason: text('reason'),
		/** Tage vorher ankündigen: 0, 3, 7 oder 14 */
		announceDays: integer('announce_days').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [
		index('location_closures_location').on(t.locationId, t.fromDate),
		check('location_closures_range', sql`${t.untilDate} >= ${t.fromDate}`),
		check('location_closures_announce', sql`${t.announceDays} in (0, 3, 7, 14)`)
	]
);

/** Speisepläne als PDF; gelöscht am Tag nach „Gültig bis“ (Kap. 15). */
export const menus = pgTable(
	'menus',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' }),
		validFrom: date('valid_from').notNull(),
		validUntil: date('valid_until').notNull(),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'restrict' }),
		uploadedBy: uuid('uploaded_by').references(() => persons.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('menus_location_from').on(t.locationId, t.validFrom),
		check('menus_valid_range', sql`${t.validUntil} >= ${t.validFrom}`)
	]
);

/** „Mein Standort“ im Konto (mehrere möglich). */
export const personLocations = pgTable(
	'person_locations',
	{
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		locationId: uuid('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.personId, t.locationId] })]
);

// ---------------------------------------------------------------------------
// Kalender (Kap. 8.8)
// ---------------------------------------------------------------------------

/** Termine einer Einheit. Zielgruppe wie bei Neuigkeiten: eigener Mandant oder (zentral) alle/ausgewählte. */
export const events = pgTable(
	'events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		/** Mandant der Einheit (Absender). */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		date: date('date').notNull(),
		allDay: boolean('all_day').notNull().default(false),
		/** HH:MM in Berliner Zeit; leer bei ganztägig */
		startTime: text('start_time'),
		endTime: text('end_time'),
		place: text('place'),
		description: text('description'),
		allTenants: boolean('all_tenants').notNull().default(false),
		createdBy: uuid('created_by').references(() => persons.id, { onDelete: 'set null' }),
		updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('events_date').on(t.date),
		index('events_unit_date').on(t.unitId, t.date),
		check(
			'events_times',
			sql`(${t.allDay} and ${t.startTime} is null and ${t.endTime} is null) or (not ${t.allDay} and ${t.startTime} is not null)`
		)
	]
);

export const eventTenants = pgTable(
	'event_tenants',
	{
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.eventId, t.tenantId] })]
);

export interface CalendarFeedConfig {
	/** Weitere Mandanten; der eigene ist immer dabei. */
	tenants: string[];
	departments: 'all' | 'selected' | 'none';
	unitIds: string[];
	/** Hubs: meine Abos (Standard), alle oder keine */
	hubs?: 'mine' | 'all' | 'none';
}

/** Persönliches iCal-Abo: Link ohne Anmeldung, sperrbar (Kap. 8.8, 15). */
export const calendarFeeds = pgTable('calendar_feeds', {
	personId: uuid('person_id')
		.primaryKey()
		.references(() => persons.id, { onDelete: 'cascade' }),
	/** SHA-256 des Tokens für die Suche beim Abruf */
	tokenHash: text('token_hash').notNull().unique(),
	/** Token verschlüsselt, damit der Link im Konto wieder angezeigt werden kann */
	tokenEnc: text('token_enc').notNull(),
	config: jsonb('config').$type<CalendarFeedConfig>().notNull(),
	createdAt: createdAt(),
	lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
	/** Gesperrt von der Person oder nach 12 Monaten ohne Abruf */
	revokedAt: timestamp('revoked_at', { withTimezone: true })
});

// ---------------------------------------------------------------------------
// Benachrichtigungen (Kap. 11)
// ---------------------------------------------------------------------------

/** Einträge der Glocke; zugleich Warteschlange für E-Mails. */
export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		topic: text('topic').notNull(),
		title: text('title').notNull(),
		/** Absender bzw. kurzer Zusatz, z. B. „IT“ */
		detail: text('detail'),
		/** Interner Pfad, z. B. /neuigkeiten/<id> */
		link: text('link').notNull(),
		/** In der Glocke sichtbar */
		bell: boolean('bell').notNull().default(true),
		readAt: timestamp('read_at', { withTimezone: true }),
		/** E-Mail: pending = noch zu senden, sent, null = keine E-Mail */
		email: text('email', { enum: ['pending', 'sent'] }),
		/** Web Push: pending = noch zu senden, sent, null = kein Push */
		push: text('push', { enum: ['pending', 'sent'] }),
		/** Ruhezeit: frühestens dann senden (null = sofort) */
		pushAfter: timestamp('push_after', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [
		index('notifications_person').on(t.personId, t.createdAt),
		index('notifications_email').on(t.email),
		index('notifications_push').on(t.push, t.pushAfter)
	]
);

// ---------------------------------------------------------------------------
// Nachrichten (Kap. 9): nur Gespräche zu Vorgängen
// ---------------------------------------------------------------------------

/**
 * Ein Gespräch zu einem Vorgang. Beteiligt sind einzelne Personen
 * (conversation_members) und optional ein gemeinsames Postfach einer Rolle
 * (role_box, bei der Moderation je Mandant).
 */
export const conversations = pgTable(
	'conversations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** anzeige = Interessierte ↔ Anzeigende; moderation = Moderation ↔ Anzeigende */
		kind: text('kind', { enum: ['anzeige', 'moderation', 'hub_antrag', 'rueckmeldung'] }).notNull(),
		subject: text('subject').notNull(),
		/** Vorgang, z. B. die Anzeige */
		refId: uuid('ref_id'),
		roleBox: text('role_box', { enum: ['moderation', 'redaktion', 'verwaltung'] }),
		roleTenantId: uuid('role_tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
		createdAt: createdAt()
	},
	(t) => [
		index('conversations_ref').on(t.refId),
		index('conversations_role').on(t.roleBox, t.roleTenantId)
	]
);

export const conversationMembers = pgTable(
	'conversation_members',
	{
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.conversationId, t.personId] }),
		index('conversation_members_person').on(t.personId)
	]
);

/** Gelesen bis – für Mitglieder und für Personen mit dem Rollen-Postfach. */
export const conversationReads = pgTable(
	'conversation_reads',
	{
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull()
	},
	(t) => [primaryKey({ columns: [t.conversationId, t.personId] })]
);

export const messages = pgTable(
	'messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		authorId: uuid('author_id').references(() => persons.id, { onDelete: 'set null' }),
		/** Geschrieben für das Rollen-Postfach (z. B. „Moderation“) */
		asRole: boolean('as_role').notNull().default(false),
		body: text('body').notNull(),
		createdAt: createdAt()
	},
	(t) => [index('messages_conversation').on(t.conversationId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Schwarzes Brett (Kap. 8.5)
// ---------------------------------------------------------------------------

export const boardCategories = pgTable('board_categories', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	position: integer('position').notNull().default(0),
	/** „Sonstiges“: nicht löschbar, nimmt Anzeigen gelöschter Kategorien auf */
	fixed: boolean('fixed').notNull().default(false)
});

export const boardAds = pgTable(
	'board_ads',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		/** Mandant der Person; dessen Moderation prüft */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => boardCategories.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		body: text('body').notNull(),
		/** „Teams-Chat“ und „E-Mail“ an der Anzeige zeigen */
		viaApps: boolean('via_apps').notNull().default(false),
		ownContact: text('own_contact'),
		status: text('status', {
			enum: ['pending', 'active', 'rejected', 'done', 'expired', 'removed']
		}).notNull(),
		rejectReason: text('reject_reason'),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		extended: boolean('extended').notNull().default(false),
		/** Zeitpunkt, ab dem die Löschfrist läuft (abgelehnt, erledigt, abgelaufen, entfernt) */
		endedAt: timestamp('ended_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('board_ads_status').on(t.status, t.expiresAt),
		index('board_ads_person').on(t.personId)
	]
);

/** „Wer sieht das?“: Ziel-Mandanten (der eigene ist immer dabei). */
export const boardAdTenants = pgTable(
	'board_ad_tenants',
	{
		adId: uuid('ad_id')
			.notNull()
			.references(() => boardAds.id, { onDelete: 'cascade' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.adId, t.tenantId] })]
);

export const boardAdPhotos = pgTable(
	'board_ad_photos',
	{
		adId: uuid('ad_id')
			.notNull()
			.references(() => boardAds.id, { onDelete: 'cascade' }),
		fileId: uuid('file_id')
			.notNull()
			.unique()
			.references(() => files.id, { onDelete: 'cascade' }),
		position: integer('position').notNull()
	},
	(t) => [primaryKey({ columns: [t.adId, t.fileId] })]
);

/** Meldungen; wer gemeldet hat, sieht nur das System. */
export const boardReports = pgTable(
	'board_reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		adId: uuid('ad_id')
			.notNull()
			.references(() => boardAds.id, { onDelete: 'cascade' }),
		reporterId: uuid('reporter_id').references(() => persons.id, { onDelete: 'set null' }),
		reason: text('reason', { enum: ['gewerblich', 'unpassend', 'sonstiges'] }).notNull(),
		createdAt: createdAt(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true })
	},
	(t) => [unique('board_reports_once').on(t.adId, t.reporterId)]
);

// ---------------------------------------------------------------------------
// Hubs (Kap. 8.3, 8.12)
// ---------------------------------------------------------------------------

/** Abo je Hub mit Kanälen (Meine Hubs, Kap. 11). Bei Pflicht-Abos nur die Kanäle. */
export const hubSubscriptions = pgTable(
	'hub_subscriptions',
	{
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		bell: boolean('bell').notNull().default(true),
		push: boolean('push').notNull().default(false),
		email: boolean('email').notNull().default(false),
		createdAt: createdAt()
	},
	(t) => [
		primaryKey({ columns: [t.personId, t.unitId] }),
		index('hub_subscriptions_unit').on(t.unitId)
	]
);

export const hubApplications = pgTable(
	'hub_applications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		applicantId: uuid('applicant_id').references(() => persons.id, { onDelete: 'set null' }),
		/** Mandant der antragstellenden Person (Redaktion und Verwaltung dieses Mandanten) */
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description').notNull(),
		reason: text('reason').notNull(),
		/** E-Mail-Adressen für das Hub-Team */
		team: jsonb('team').$type<string[]>().notNull(),
		/** Zuständigkeit: nur der eigene Mandant oder zentral (alle) */
		central: boolean('central').notNull().default(false),
		status: text('status', {
			enum: ['neu', 'bei_verwaltung', 'angelegt', 'abgelehnt', 'geschlossen']
		}).notNull(),
		decisionReason: text('decision_reason'),
		unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
		endedAt: timestamp('ended_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('hub_applications_status').on(t.status, t.tenantId)]
);

// ---------------------------------------------------------------------------
// Abteilungsseiten: Wer hilft bei was? (Kap. 8.11)
// ---------------------------------------------------------------------------

export interface ResponsibilityLink {
	label: string;
	url: string;
}

/** Zuständigkeit einer Einheit: Thema mit einer Ansprechperson und Vertretung. */
export const responsibilities = pgTable(
	'responsibilities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		unitId: uuid('unit_id')
			.notNull()
			.references(() => units.id, { onDelete: 'cascade' }),
		topic: text('topic').notNull(),
		description: text('description'),
		keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
		/** Gruppe zum Gliedern, z. B. „Arbeitsplatz“ */
		groupName: text('group_name'),
		personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
		deputyId: uuid('deputy_id').references(() => persons.id, { onDelete: 'set null' }),
		links: jsonb('links').$type<ResponsibilityLink[]>().notNull().default([]),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('responsibilities_unit').on(t.unitId, t.position)]
);

// ---------------------------------------------------------------------------
// Rechtliches (Kap. 8.10)
// ---------------------------------------------------------------------------

/**
 * Betriebs- und Dienstvereinbarungen je Mandant. Keine Entwürfe, keine
 * früheren Fassungen: Eine neue Fassung ersetzt die alte vollständig.
 */
export const agreements = pgTable(
	'agreements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['betrieb', 'dienst'] }).notNull(),
		title: text('title').notNull(),
		description: text('description'),
		/** Stand der Fassung */
		versionDate: date('version_date').notNull(),
		validFrom: date('valid_from').notNull(),
		updatedBy: uuid('updated_by').references(() => persons.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('agreements_tenant').on(t.tenantId, t.kind)]
);

export const agreementAttachments = pgTable(
	'agreement_attachments',
	{
		agreementId: uuid('agreement_id')
			.notNull()
			.references(() => agreements.id, { onDelete: 'cascade' }),
		fileId: uuid('file_id')
			.notNull()
			.references(() => files.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.agreementId, t.fileId] })]
);

/** Gesetze und Tarifverträge: einfache Liste je Mandant (Link oder Datei). */
export const legalLinks = pgTable(
	'legal_links',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['gesetz', 'tarif'] }).notNull(),
		title: text('title').notNull(),
		description: text('description'),
		url: text('url'),
		fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('legal_links_tenant').on(t.tenantId, t.kind, t.position)]
);

// ---------------------------------------------------------------------------
// Web Push (Kap. 11.1)
// ---------------------------------------------------------------------------

/** Push-Abo eines Geräts (Browser). Endpunkte nur bei bekannten Push-Diensten. */
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id')
			.notNull()
			.references(() => persons.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		/** Kurze Gerätebeschreibung, z. B. „Chrome auf Windows“ */
		label: text('label'),
		failures: integer('failures').notNull().default(0),
		lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [index('push_subscriptions_person').on(t.personId)]
);

// ---------------------------------------------------------------------------
// Rückmeldungen (Kap. 13)
// ---------------------------------------------------------------------------

/** Fehler oder Idee mit Angabe der Seite; Bearbeitung durch die Verwaltung des Mandanten. */
export const feedback = pgTable(
	'feedback',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['fehler', 'idee'] }).notNull(),
		text: text('text').notNull(),
		/** Seite, von der die Rückmeldung kam (interner Pfad) */
		page: text('page'),
		status: text('status', { enum: ['neu', 'in_arbeit', 'erledigt', 'abgelehnt'] })
			.notNull()
			.default('neu'),
		/** Kurze Antwort beim Abschluss (für „Meine Meldungen“) */
		answer: text('answer'),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('feedback_tenant_status').on(t.tenantId, t.status),
		index('feedback_person').on(t.personId)
	]
);
