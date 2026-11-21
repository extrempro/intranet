ALTER TABLE "feedback" ADD COLUMN "technik" jsonb;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "screenshot_file_id" uuid;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_screenshot_file_id_files_id_fk" FOREIGN KEY ("screenshot_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;