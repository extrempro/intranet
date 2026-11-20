CREATE TABLE "favorites" (
	"person_id" uuid NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_person_id_key_pk" PRIMARY KEY("person_id","key")
);
--> statement-breakpoint
CREATE TABLE "person_preferences" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'auto' NOT NULL,
	"home_layout" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "accent_color_dark" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "home_default" jsonb;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_preferences" ADD CONSTRAINT "person_preferences_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_accent_color_dark_hex" CHECK ("tenants"."accent_color_dark" ~ '^#[0-9a-fA-F]{6}$');