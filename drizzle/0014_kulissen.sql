ALTER TABLE "news" ADD COLUMN "channel" text DEFAULT 'news' NOT NULL;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_preferences" ADD COLUMN "behind_tenants" jsonb;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "behind_scenes" boolean DEFAULT false NOT NULL;