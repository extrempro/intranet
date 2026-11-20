CREATE TABLE "org_chart" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"file_id" uuid NOT NULL,
	"stand" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_chart_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "org_chart_singleton" CHECK ("org_chart"."id" = 1),
	CONSTRAINT "org_chart_stand" CHECK ("org_chart"."stand" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"title" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "plans_valid_range" CHECK ("plans"."valid_until" >= "plans"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "org_chart" ADD CONSTRAINT "org_chart_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_chart" ADD CONSTRAINT "org_chart_updated_by_persons_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_uploaded_by_persons_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plans_unit_from" ON "plans" USING btree ("unit_id","valid_from");