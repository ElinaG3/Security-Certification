CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "ingested_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file" text NOT NULL,
	"exam_version" text DEFAULT 'SY0-701' NOT NULL,
	"objective" text,
	"section_title" text,
	"sub_topic" text,
	"content" text NOT NULL,
	"embedding" vector(384),
	"max_card_similarity" real,
	"used_for_generation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
