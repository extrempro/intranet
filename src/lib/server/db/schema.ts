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
import type { HomeLayout } from '../../home';
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
		// Selbst gepflegte Kontaktdaten (Kap. 8.13), keine Übernahme aus Entra
		position: text('position'),
		phone: text('phone'),
		mobile: text('mobile'),
		mobileVisibility: mobileVisibility('mobile_visibility').notNull().default('team'),
		room: text('room'),
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
 * GRP-INTRANET-REDAKTION → Redaktion · alle Mandanten.
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
