CREATE TABLE "invitations" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "local_credentials" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text,
	"totp_secret_enc" text,
	"totp_confirmed_at" timestamp with time zone,
	"totp_last_step" integer,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"last_failed_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[],
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pending_logins" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"challenge" text,
	"pending_totp_enc" text,
	"setup_done" boolean DEFAULT false NOT NULL,
	"ziel" text DEFAULT '/' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_credentials" ADD CONSTRAINT "local_credentials_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_logins" ADD CONSTRAINT "pending_logins_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_person" ON "invitations" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "passkeys_person" ON "passkeys" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "recovery_codes_person" ON "recovery_codes" USING btree ("person_id");