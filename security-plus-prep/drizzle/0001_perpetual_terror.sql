CREATE TABLE "explanation_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"distractor_explanations" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "learning_steps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "learning_steps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "response_ms" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "explanation_suggestions" ADD CONSTRAINT "explanation_suggestions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;