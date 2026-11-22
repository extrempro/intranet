CREATE TABLE "faq_topics" (
	"faq_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "faq_topics_faq_id_topic_id_pk" PRIMARY KEY("faq_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topic_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"suggested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_topics" (
	"video_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "video_topics_video_id_topic_id_pk" PRIMARY KEY("video_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'hochladen' NOT NULL,
	"tenant_ids" uuid[],
	"key_enc" text NOT NULL,
	"storage_target_id" uuid,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"heights" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"captions_vtt" text,
	"captions_text" text DEFAULT '' NOT NULL,
	"chapters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"upload_size" bigint DEFAULT 0 NOT NULL,
	"upload_received" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "unit_members" ADD COLUMN "may_write_media" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "faq_topics" ADD CONSTRAINT "faq_topics_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_topics" ADD CONSTRAINT "faq_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_suggestions" ADD CONSTRAINT "topic_suggestions_suggested_by_persons_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_topics" ADD CONSTRAINT "video_topics_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_topics" ADD CONSTRAINT "video_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_storage_target_id_storage_targets_id_fk" FOREIGN KEY ("storage_target_id") REFERENCES "public"."storage_targets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "topics_name_lower" ON "topics" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "videos_unit" ON "videos" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "videos_status" ON "videos" USING btree ("status");--> statement-breakpoint
-- Lesen mit der App-Rolle: Videos sichtbarer Einheiten, bei Einschränkung nur für die genannten Mandanten.
-- Entwürfe und Videos in Arbeit filtert die Anwendung zusätzlich nach dem Recht „Mediathek“.
GRANT SELECT ON videos, video_topics, topics, faq_topics TO intranet_app;--> statement-breakpoint
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY videos_select ON videos FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id)
		AND (tenant_ids IS NULL OR app_tenant_id() = ANY (tenant_ids)));--> statement-breakpoint
ALTER TABLE video_topics ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY video_topics_select ON video_topics FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM videos v WHERE v.id = video_id));--> statement-breakpoint
ALTER TABLE faq_topics ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY faq_topics_select ON faq_topics FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM faqs f WHERE f.id = faq_id));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS videos_fts ON videos USING gin (
	(setweight(to_tsvector('intranet_de', title), 'A') || setweight(to_tsvector('intranet_de', description || ' ' || captions_text), 'B'))
);
