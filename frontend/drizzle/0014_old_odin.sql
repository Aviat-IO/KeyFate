ALTER TYPE "public"."secret_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "last_retry_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disclosure_log_batch_fetch_idx" ON "disclosure_log" USING btree ("secret_id","recipient_email","status","created_at");