CREATE TABLE "board_ad_photos" (
	"ad_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "board_ad_photos_ad_id_file_id_pk" PRIMARY KEY("ad_id","file_id"),
	CONSTRAINT "board_ad_photos_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "board_ad_tenants" (
	"ad_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "board_ad_tenants_ad_id_tenant_id_pk" PRIMARY KEY("ad_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "board_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"via_apps" boolean DEFAULT false NOT NULL,
	"own_contact" text,
	"status" text NOT NULL,
	"reject_reason" text,
	"expires_at" timestamp with time zone,
	"extended" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"fixed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "board_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "board_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "board_reports_once" UNIQUE("ad_id","reporter_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_person_id_pk" PRIMARY KEY("conversation_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_reads" (
	"conversation_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "conversation_reads_conversation_id_person_id_pk" PRIMARY KEY("conversation_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"ref_id" uuid,
	"role_box" text,
	"role_tenant_id" uuid,
	"closed_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid,
	"as_role" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_preferences" ADD COLUMN "board_tenants" jsonb;--> statement-breakpoint
ALTER TABLE "board_ad_photos" ADD CONSTRAINT "board_ad_photos_ad_id_board_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."board_ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ad_photos" ADD CONSTRAINT "board_ad_photos_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ad_tenants" ADD CONSTRAINT "board_ad_tenants_ad_id_board_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."board_ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ad_tenants" ADD CONSTRAINT "board_ad_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ads" ADD CONSTRAINT "board_ads_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ads" ADD CONSTRAINT "board_ads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_ads" ADD CONSTRAINT "board_ads_category_id_board_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."board_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_reports" ADD CONSTRAINT "board_reports_ad_id_board_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."board_ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_reports" ADD CONSTRAINT "board_reports_reporter_id_persons_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_role_tenant_id_tenants_id_fk" FOREIGN KEY ("role_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_persons_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_ads_status" ON "board_ads" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "board_ads_person" ON "board_ads" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "conversation_members_person" ON "conversation_members" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "conversations_ref" ON "conversations" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "conversations_role" ON "conversations" USING btree ("role_box","role_tenant_id");--> statement-breakpoint
CREATE INDEX "messages_conversation" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
INSERT INTO "board_categories" ("name", "position", "fixed") VALUES
	('Verschenken', 0, false), ('Verkaufen', 1, false), ('Suchen', 2, false), ('Wohnen', 3, false),
	('Mitfahren', 4, false), ('Freizeit', 5, false), ('Sonstiges', 99, true);
