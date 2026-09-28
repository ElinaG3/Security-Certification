CREATE TABLE "grading_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_log_id" uuid NOT NULL,
	"correction_log_id" uuid,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"submitted_answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "pre_review_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "grading_overrides" ADD CONSTRAINT "grading_overrides_review_log_id_review_log_id_fk" FOREIGN KEY ("review_log_id") REFERENCES "public"."review_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_overrides" ADD CONSTRAINT "grading_overrides_correction_log_id_review_log_id_fk" FOREIGN KEY ("correction_log_id") REFERENCES "public"."review_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_overrides" ADD CONSTRAINT "grading_overrides_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_overrides" ADD CONSTRAINT "grading_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;