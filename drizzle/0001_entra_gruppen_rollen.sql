CREATE TABLE "entra_group_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"group_name" text,
	"role" "role_name" NOT NULL,
	"scope" "role_scope" NOT NULL,
	"scope_tenant_id" uuid,
	"scope_unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entra_group_roles_unique" UNIQUE NULLS NOT DISTINCT("group_id","role","scope","scope_tenant_id","scope_unit_id"),
	CONSTRAINT "entra_group_roles_scope_columns" CHECK (("entra_group_roles"."scope" = 'all' and "entra_group_roles"."scope_tenant_id" is null and "entra_group_roles"."scope_unit_id" is null)
			or ("entra_group_roles"."scope" = 'tenant' and "entra_group_roles"."scope_tenant_id" is not null and "entra_group_roles"."scope_unit_id" is null)
			or ("entra_group_roles"."scope" = 'unit' and "entra_group_roles"."scope_unit_id" is not null and "entra_group_roles"."scope_tenant_id" is null))
);
--> statement-breakpoint
ALTER TABLE "entra_group_roles" ADD CONSTRAINT "entra_group_roles_scope_tenant_id_tenants_id_fk" FOREIGN KEY ("scope_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entra_group_roles" ADD CONSTRAINT "entra_group_roles_scope_unit_id_units_id_fk" FOREIGN KEY ("scope_unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entra_group_roles_group" ON "entra_group_roles" USING btree ("group_id");