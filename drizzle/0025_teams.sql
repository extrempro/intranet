ALTER TABLE "notifications" ADD COLUMN "teams" text;--> statement-breakpoint
CREATE INDEX "notifications_teams" ON "notifications" USING btree ("teams","push_after");