ALTER TABLE "cards" ADD COLUMN "mnemonic" text;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "elaboration_skipped" boolean DEFAULT false NOT NULL;