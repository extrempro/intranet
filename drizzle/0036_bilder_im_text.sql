CREATE TABLE "text_images" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"news_id" uuid,
	"faq_id" uuid,
	CONSTRAINT "text_images_ein_besitzer" CHECK (("text_images"."news_id" is null) <> ("text_images"."faq_id" is null))
);
--> statement-breakpoint
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_images" ADD CONSTRAINT "text_images_faq_id_faqs_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "text_images_news" ON "text_images" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "text_images_faq" ON "text_images" USING btree ("faq_id");