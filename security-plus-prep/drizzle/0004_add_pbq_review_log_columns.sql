ALTER TABLE "review_log" ADD COLUMN "scheduled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "review_log" ADD COLUMN "sub_results" jsonb;