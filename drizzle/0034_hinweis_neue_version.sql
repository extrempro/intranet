ALTER TABLE "person_preferences" ADD COLUMN "version_hint" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "person_preferences" ADD COLUMN "version_seen" text;