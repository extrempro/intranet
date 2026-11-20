CREATE TABLE "responsibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_name" text,
	"person_id" uuid,
	"deputy_id" uuid,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "responsibilities_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "review_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "responsibilities" ADD CONSTRAINT "responsibilities_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibilities" ADD CONSTRAINT "responsibilities_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsibilities" ADD CONSTRAINT "responsibilities_deputy_id_persons_id_fk" FOREIGN KEY ("deputy_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "responsibilities_unit" ON "responsibilities" USING btree ("unit_id","position");