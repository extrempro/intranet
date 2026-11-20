CREATE TABLE "tenant_assets" (
	"tenant_id" uuid NOT NULL,
	"art" text NOT NULL,
	"data" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_assets_tenant_id_art_pk" PRIMARY KEY("tenant_id","art")
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "bg_color" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "bg_color_dark" text;--> statement-breakpoint
ALTER TABLE "tenant_assets" ADD CONSTRAINT "tenant_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_bg_color_hex" CHECK ("tenants"."bg_color" ~ '^#[0-9a-fA-F]{6}$');--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_bg_color_dark_hex" CHECK ("tenants"."bg_color_dark" ~ '^#[0-9a-fA-F]{6}$');