ALTER TABLE "videos" ADD COLUMN "suggestion_status" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "suggestion" jsonb;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "suggestion_error" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "suggestion_by" uuid;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "suggestion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_suggestion_by_persons_id_fk" FOREIGN KEY ("suggestion_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;