CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"publish_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"all_tenants" boolean DEFAULT false NOT NULL,
	"pinned_until" timestamp with time zone,
	"pinned_by_editorial" boolean DEFAULT false NOT NULL,
	"urgent_until" timestamp with time zone,
	"urgent_text" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_urgent_text" CHECK (("news"."urgent_until" is null) = ("news"."urgent_text" is null)),
	CONSTRAINT "news_expiry_after_urgent" CHECK ("news"."expires_at" is null or "news"."urgent_until" is null or "news"."expires_at" >= "news"."urgent_until")
);
--> statement-breakpoint
CREATE TABLE "news_reactions" (
	"news_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	CONSTRAINT "news_reactions_news_id_person_id_pk" PRIMARY KEY("news_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "news_tenants" (
	"news_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "news_tenants_news_id_tenant_id_pk" PRIMARY KEY("news_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "urgent_dismissals" (
	"news_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "urgent_dismissals_news_id_person_id_pk" PRIMARY KEY("news_id","person_id")
);
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_updated_by_persons_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_tenants" ADD CONSTRAINT "news_tenants_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_tenants" ADD CONSTRAINT "news_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urgent_dismissals" ADD CONSTRAINT "urgent_dismissals_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urgent_dismissals" ADD CONSTRAINT "urgent_dismissals_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_publish" ON "news" USING btree ("publish_at");--> statement-breakpoint
CREATE INDEX "news_unit" ON "news" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "news_tenants_tenant" ON "news_tenants" USING btree ("tenant_id");