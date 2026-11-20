CREATE TABLE "faq_attachments" (
	"faq_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "faq_attachments_faq_id_file_id_pk" PRIMARY KEY("faq_id","file_id"),
	CONSTRAINT "faq_attachments_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer_html" text NOT NULL,
	"answer_text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"until_date" date NOT NULL,
	"reason" text,
	"announce_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_closures_range" CHECK ("location_closures"."until_date" >= "location_closures"."from_date"),
	CONSTRAINT "location_closures_announce" CHECK ("location_closures"."announce_days" in (0, 3, 7, 14))
);
--> statement-breakpoint
CREATE TABLE "location_operators" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"hours" jsonb NOT NULL,
	"place" text,
	"note" text,
	"contact" text,
	"closed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_until" date NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "menus_valid_range" CHECK ("menus"."valid_until" >= "menus"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "person_locations" (
	"person_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "person_locations_person_id_location_id_pk" PRIMARY KEY("person_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "faq_attachments" ADD CONSTRAINT "faq_attachments_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_attachments" ADD CONSTRAINT "faq_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_updated_by_persons_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_closures" ADD CONSTRAINT "location_closures_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_operators" ADD CONSTRAINT "location_operators_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_operators" ADD CONSTRAINT "location_operators_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_uploaded_by_persons_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_locations" ADD CONSTRAINT "person_locations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_locations" ADD CONSTRAINT "person_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faqs_unit_position" ON "faqs" USING btree ("unit_id","position");--> statement-breakpoint
CREATE INDEX "location_closures_location" ON "location_closures" USING btree ("location_id","from_date");--> statement-breakpoint
CREATE INDEX "locations_tenant" ON "locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "menus_location_from" ON "menus" USING btree ("location_id","valid_from");--> statement-breakpoint
-- FAQs: Lesen mit der App-Rolle; sichtbar, wenn die Einheit sichtbar ist (RLS auf units).
GRANT SELECT ON faqs, faq_attachments TO intranet_app;--> statement-breakpoint
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY faqs_select ON faqs FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id));--> statement-breakpoint
ALTER TABLE faq_attachments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY faq_attachments_select ON faq_attachments FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM faqs f WHERE f.id = faq_id));
