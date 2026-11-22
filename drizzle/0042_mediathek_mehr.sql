CREATE TABLE "video_attachments" (
	"video_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "video_attachments_video_id_file_id_pk" PRIMARY KEY("video_id","file_id"),
	CONSTRAINT "video_attachments_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "captions_source" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "captions_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "captions_checked_by" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "transcript_html" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "media_id" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "replaces_id" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "upload_head" text;--> statement-breakpoint
ALTER TABLE "video_attachments" ADD CONSTRAINT "video_attachments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_attachments" ADD CONSTRAINT "video_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_captions_checked_by_persons_id_fk" FOREIGN KEY ("captions_checked_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_replaces_id_videos_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "videos_replaces" ON "videos" USING btree ("replaces_id");--> statement-breakpoint
-- Vorhandene Untertitel stammen aus hochgeladenen Dateien
UPDATE videos SET captions_source = 'hochgeladen' WHERE captions_vtt IS NOT NULL;--> statement-breakpoint
GRANT SELECT ON video_attachments TO intranet_app;--> statement-breakpoint
ALTER TABLE video_attachments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY video_attachments_select ON video_attachments FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM videos v WHERE v.id = video_id));
