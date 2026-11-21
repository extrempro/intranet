CREATE TABLE "unit_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_document_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"folder_id" uuid,
	"file_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_documents_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "unit_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"icon" text DEFAULT 'link' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "text_images" DROP CONSTRAINT "text_images_ein_besitzer";--> statement-breakpoint
ALTER TABLE "text_images" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_members" ADD COLUMN "may_write_documents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_members" ADD COLUMN "hub_task" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "notice_until" date;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "coordinator_person_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "about_html" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "cover_file_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "icon_file_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_contacts" ADD CONSTRAINT "unit_contacts_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_contacts" ADD CONSTRAINT "unit_contacts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_document_folders" ADD CONSTRAINT "unit_document_folders_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_folder_id_unit_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."unit_document_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_documents" ADD CONSTRAINT "unit_documents_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_links" ADD CONSTRAINT "unit_links_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unit_contacts_unit" ON "unit_contacts" USING btree ("unit_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_contacts_einmal" ON "unit_contacts" USING btree ("unit_id","person_id");--> statement-breakpoint
CREATE INDEX "unit_document_folders_unit" ON "unit_document_folders" USING btree ("unit_id","position");--> statement-breakpoint
CREATE INDEX "unit_documents_unit" ON "unit_documents" USING btree ("unit_id","folder_id","position");--> statement-breakpoint
CREATE INDEX "unit_links_unit" ON "unit_links" USING btree ("unit_id","position");--> statement-breakpoint
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_coordinator_person_id_persons_id_fk" FOREIGN KEY ("coordinator_person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_cover_file_id_files_id_fk" FOREIGN KEY ("cover_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_icon_file_id_files_id_fk" FOREIGN KEY ("icon_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "text_images_unit" ON "text_images" USING btree ("unit_id");--> statement-breakpoint
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_ein_besitzer" CHECK (num_nonnulls("text_images"."news_id", "text_images"."faq_id", "text_images"."unit_id") = 1);--> statement-breakpoint
-- Neue Abschnitte auf vorhandenen Hub-Seiten einblenden (ausgeblendete fehlen im Aufbau)
UPDATE units SET page_layout = jsonb_build_object(
	'main', '["schnellzugriff"]'::jsonb || coalesce(page_layout->'main', '[]'::jsonb) || '["dokumente"]'::jsonb,
	'side', '["hubteam"]'::jsonb || coalesce(page_layout->'side', '[]'::jsonb) || '["faqs"]'::jsonb
) WHERE type = 'hub' AND page_layout IS NOT NULL;
