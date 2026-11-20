CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"link" text NOT NULL,
	"bell" boolean DEFAULT true NOT NULL,
	"read_at" timestamp with time zone,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "notified_urgent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person_preferences" ADD COLUMN "notify" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_person" ON "notifications" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_email" ON "notifications" USING btree ("email");--> statement-breakpoint
-- Bestehende Beiträge nicht nachträglich melden
UPDATE "news" SET "notified_at" = now(), "notified_urgent" = true;
