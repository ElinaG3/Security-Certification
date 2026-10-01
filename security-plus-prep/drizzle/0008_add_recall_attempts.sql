CREATE TABLE "recall_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"objective" text,
	"topic" text NOT NULL,
	"input_mode" text NOT NULL,
	"raw_text" text,
	"image_url" text,
	"transcription" text,
	"confirmed_transcription" text,
	"gap_report" jsonb,
	"score" real,
	"drawing_url" text,
	"drawing_comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recall_attempts" ADD CONSTRAINT "recall_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;