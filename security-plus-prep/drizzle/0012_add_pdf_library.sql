CREATE TABLE "pdf_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"blob_url" text NOT NULL,
	"page_count" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingested_chunks" ADD COLUMN "pdf_id" uuid;--> statement-breakpoint
ALTER TABLE "ingested_chunks" ADD COLUMN "start_page" integer;--> statement-breakpoint
ALTER TABLE "ingested_chunks" ADD COLUMN "end_page" integer;--> statement-breakpoint
ALTER TABLE "pdf_library" ADD CONSTRAINT "pdf_library_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_chunks" ADD CONSTRAINT "ingested_chunks_pdf_id_pdf_library_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."pdf_library"("id") ON DELETE no action ON UPDATE no action;