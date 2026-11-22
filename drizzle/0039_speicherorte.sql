CREATE TABLE "storage_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"target_id" uuid,
	"status" text DEFAULT 'laufend' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"message" text,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "storage_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"region" text NOT NULL,
	"bucket" text NOT NULL,
	"access_key" text NOT NULL,
	"secret_enc" text NOT NULL,
	"path_style" boolean DEFAULT true NOT NULL,
	"checked_at" timestamp with time zone,
	"check_ok" boolean,
	"check_versioning" boolean,
	"check_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "category" text DEFAULT 'inhalte' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "storage_target_id" uuid;--> statement-breakpoint
ALTER TABLE "storage_moves" ADD CONSTRAINT "storage_moves_target_id_storage_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."storage_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_moves" ADD CONSTRAINT "storage_moves_started_by_persons_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_storage_target_id_storage_targets_id_fk" FOREIGN KEY ("storage_target_id") REFERENCES "public"."storage_targets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
UPDATE "files" f SET "category" = 'plaene' WHERE EXISTS (SELECT 1 FROM plans p WHERE p.file_id = f.id) OR EXISTS (SELECT 1 FROM menus m WHERE m.file_id = f.id) OR EXISTS (SELECT 1 FROM org_chart o WHERE o.file_id = f.id);--> statement-breakpoint
UPDATE "files" f SET "category" = 'bilder' WHERE EXISTS (SELECT 1 FROM persons p WHERE p.photo_file_id = f.id) OR EXISTS (SELECT 1 FROM units u WHERE u.cover_file_id = f.id OR u.icon_file_id = f.id);--> statement-breakpoint
UPDATE "files" f SET "category" = 'rueckmeldungen' WHERE EXISTS (SELECT 1 FROM feedback fb WHERE fb.screenshot_file_id = f.id);--> statement-breakpoint
CREATE INDEX "files_category_target" ON "files" ("category", "storage_target_id");
