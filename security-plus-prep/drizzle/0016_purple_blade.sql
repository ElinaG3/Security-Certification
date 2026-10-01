CREATE TABLE "vocab_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"certification_id" uuid,
	"term" text NOT NULL,
	"translation_de" text NOT NULL,
	"context_note" text NOT NULL,
	"lookup_count" integer DEFAULT 1 NOT NULL,
	"first_looked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_looked_up_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_terms" ADD CONSTRAINT "vocab_terms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_terms" ADD CONSTRAINT "vocab_terms_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_terms_user_term" ON "vocab_terms" USING btree ("user_id","term");