CREATE TABLE "learning_routine_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"certification_id" uuid NOT NULL,
	"day_key" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"step" text DEFAULT 'start' NOT NULL,
	"topic" text,
	"c1" jsonb,
	"c2" jsonb,
	"c3" jsonb,
	"c4" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "learning_routine_sessions" ADD CONSTRAINT "learning_routine_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_routine_sessions" ADD CONSTRAINT "learning_routine_sessions_certification_id_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_routine_sessions_user_cert_day" ON "learning_routine_sessions" USING btree ("user_id","certification_id","day_key");