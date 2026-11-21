CREATE TABLE "draft_files" (
	"draft_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "draft_files_draft_id_file_id_pk" PRIMARY KEY("draft_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"art" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_art" CHECK ("drafts"."art" in ('news', 'kulissen', 'faq'))
);
--> statement-breakpoint
ALTER TABLE "draft_files" ADD CONSTRAINT "draft_files_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_files" ADD CONSTRAINT "draft_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_files_file" ON "draft_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "drafts_person" ON "drafts" USING btree ("person_id","updated_at");--> statement-breakpoint
-- Entwürfe sieht und ändert nur die eigene Person (Row-Level Security)
GRANT SELECT, INSERT, UPDATE, DELETE ON drafts, draft_files TO intranet_app;--> statement-breakpoint
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY drafts_own ON drafts FOR ALL TO intranet_app
	USING (person_id = app_person_id())
	WITH CHECK (person_id = app_person_id());--> statement-breakpoint
ALTER TABLE draft_files ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY draft_files_own ON draft_files FOR ALL TO intranet_app
	USING (EXISTS (SELECT 1 FROM drafts d WHERE d.id = draft_id))
	WITH CHECK (EXISTS (SELECT 1 FROM drafts d WHERE d.id = draft_id));
