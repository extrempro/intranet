CREATE TABLE "hub_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_id" uuid,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"reason" text NOT NULL,
	"team" jsonb NOT NULL,
	"central" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"decision_reason" text,
	"unit_id" uuid,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_subscriptions" (
	"person_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"bell" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_subscriptions_person_id_unit_id_pk" PRIMARY KEY("person_id","unit_id")
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "about" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "notice" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "mandatory_subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "resting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "page_layout" jsonb;--> statement-breakpoint
ALTER TABLE "hub_applications" ADD CONSTRAINT "hub_applications_applicant_id_persons_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_applications" ADD CONSTRAINT "hub_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_applications" ADD CONSTRAINT "hub_applications_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_subscriptions" ADD CONSTRAINT "hub_subscriptions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_subscriptions" ADD CONSTRAINT "hub_subscriptions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hub_applications_status" ON "hub_applications" USING btree ("status","tenant_id");--> statement-breakpoint
CREATE INDEX "hub_subscriptions_unit" ON "hub_subscriptions" USING btree ("unit_id");