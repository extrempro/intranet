CREATE TYPE "public"."audit_category" AS ENUM('admin', 'security');--> statement-breakpoint
CREATE TYPE "public"."auth_source" AS ENUM('entra', 'local');--> statement-breakpoint
CREATE TYPE "public"."mobile_visibility" AS ENUM('all', 'team', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('invited', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."role_name" AS ENUM('redaktion', 'abteilungsverwaltung', 'hub_team', 'organigramm_pflegen', 'vereinbarungen_pflegen', 'fachpflege', 'moderation_schwarzes_brett', 'mandanten_admin', 'system_admin');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('all', 'tenant', 'unit');--> statement-breakpoint
CREATE TYPE "public"."role_source" AS ENUM('manual', 'entra');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('geschaeftsfuehrung', 'stabsstelle', 'abteilung', 'hub');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" "audit_category" NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"tenant_id" uuid,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"ip_prefix" text
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"auth_source" "auth_source" NOT NULL,
	"entra_oid" text,
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"disabled_at" timestamp with time zone,
	"position" text,
	"phone" text,
	"mobile" text,
	"mobile_visibility" "mobile_visibility" DEFAULT 'team' NOT NULL,
	"room" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_entra_oid_unique" UNIQUE("entra_oid"),
	CONSTRAINT "persons_entra_oid_matches_source" CHECK (("persons"."auth_source" = 'entra') = ("persons"."entra_oid" is not null)),
	CONSTRAINT "persons_disabled_at" CHECK (("persons"."status" = 'disabled') = ("persons"."disabled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "role_name" NOT NULL,
	"scope" "role_scope" NOT NULL,
	"scope_tenant_id" uuid,
	"scope_unit_id" uuid,
	"source" "role_source" DEFAULT 'manual' NOT NULL,
	"entra_group_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "role_assignments_unique" UNIQUE NULLS NOT DISTINCT("person_id","role","scope","scope_tenant_id","scope_unit_id","source"),
	CONSTRAINT "role_assignments_scope_columns" CHECK (("role_assignments"."scope" = 'all' and "role_assignments"."scope_tenant_id" is null and "role_assignments"."scope_unit_id" is null)
			or ("role_assignments"."scope" = 'tenant' and "role_assignments"."scope_tenant_id" is not null and "role_assignments"."scope_unit_id" is null)
			or ("role_assignments"."scope" = 'unit' and "role_assignments"."scope_unit_id" is not null and "role_assignments"."scope_tenant_id" is null)),
	CONSTRAINT "role_assignments_entra_group" CHECK (("role_assignments"."source" = 'entra') = ("role_assignments"."entra_group_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"auth_method" "auth_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip_prefix" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tenant_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "tenant_domains_lowercase" CHECK ("tenant_domains"."domain" = lower("tenant_domains"."domain"))
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"accent_color" text,
	"artistic_lead_unit_id" uuid,
	"commercial_lead_unit_id" uuid,
	"kbb_unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_short_name_unique" UNIQUE("short_name"),
	CONSTRAINT "tenants_accent_color_hex" CHECK ("tenants"."accent_color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "unit_members" (
	"unit_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"may_write_news" boolean DEFAULT false NOT NULL,
	"may_write_faqs" boolean DEFAULT false NOT NULL,
	"may_write_events" boolean DEFAULT false NOT NULL,
	"may_write_behind_scenes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_members_unit_id_person_id_pk" PRIMARY KEY("unit_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "unit_type" NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"slug" text NOT NULL,
	"is_central" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"lead_person_id" uuid,
	"second_lead_person_id" uuid,
	"deputy_person_id" uuid,
	"may_post_urgent" boolean,
	"may_create_events" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_slug_unique" UNIQUE("slug"),
	CONSTRAINT "units_title_only_lead_or_staff" CHECK ("units"."title" is null or "units"."type" in ('geschaeftsfuehrung', 'stabsstelle')),
	CONSTRAINT "units_staff_is_central" CHECK ("units"."type" <> 'stabsstelle' or "units"."is_central"),
	CONSTRAINT "units_slug_format" CHECK ("units"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_persons_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_scope_tenant_id_tenants_id_fk" FOREIGN KEY ("scope_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_scope_unit_id_units_id_fk" FOREIGN KEY ("scope_unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_persons_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_artistic_lead_unit_id_units_id_fk" FOREIGN KEY ("artistic_lead_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_commercial_lead_unit_id_units_id_fk" FOREIGN KEY ("commercial_lead_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_kbb_unit_id_units_id_fk" FOREIGN KEY ("kbb_unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_lead_person_id_persons_id_fk" FOREIGN KEY ("lead_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_second_lead_person_id_persons_id_fk" FOREIGN KEY ("second_lead_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_deputy_person_id_persons_id_fk" FOREIGN KEY ("deputy_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_category_at" ON "audit_log" USING btree ("category","at");--> statement-breakpoint
CREATE INDEX "audit_log_actor" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_email" ON "persons" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "persons_tenant" ON "persons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "role_assignments_person" ON "role_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "sessions_person" ON "sessions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tenant_domains_tenant" ON "tenant_domains" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_one_main" ON "tenants" USING btree ("is_main") WHERE "tenants"."is_main";--> statement-breakpoint
CREATE INDEX "unit_members_person" ON "unit_members" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_members_one_primary" ON "unit_members" USING btree ("person_id") WHERE "unit_members"."is_primary";--> statement-breakpoint
CREATE INDEX "units_tenant" ON "units" USING btree ("tenant_id");