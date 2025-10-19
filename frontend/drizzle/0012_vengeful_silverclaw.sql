CREATE TYPE "public"."disclosure_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disclosure_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text,
	"status" "disclosure_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminder_jobs" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reminder_jobs" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "last_error" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disclosure_log" ADD CONSTRAINT "disclosure_log_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
