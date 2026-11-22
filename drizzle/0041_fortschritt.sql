CREATE TABLE "video_progress" (
	"person_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position_sec" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_progress_person_id_video_id_pk" PRIMARY KEY("person_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "person_preferences" ADD COLUMN "video_progress" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Nur die Person selbst liest und schreibt ihren Stand, und nur zu Videos, die sie sieht.
GRANT SELECT, INSERT, UPDATE, DELETE ON video_progress TO intranet_app;--> statement-breakpoint
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY video_progress_own ON video_progress FOR ALL TO intranet_app
	USING (person_id = app_person_id())
	WITH CHECK (person_id = app_person_id() AND EXISTS (SELECT 1 FROM videos v WHERE v.id = video_id));
