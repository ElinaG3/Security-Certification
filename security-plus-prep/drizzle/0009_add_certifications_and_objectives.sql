CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"exam_code" text NOT NULL,
	"domains" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certifications_exam_code_unique" UNIQUE("exam_code")
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certification_id" uuid NOT NULL,
	"number" text NOT NULL,
	"title" text,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE no action ON UPDATE no action;