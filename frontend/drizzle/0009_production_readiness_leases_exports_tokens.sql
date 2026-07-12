ALTER TABLE "check_in_tokens" ADD COLUMN "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "artifact_data" text;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "artifact_sha256" text;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "artifact_stored_size" integer;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_export_jobs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "disclosure_log" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "disclosure_log" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "processing_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "processing_lease_expires_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_export_jobs_claim" ON "data_export_jobs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "idx_secrets_processing_lease" ON "secrets" USING btree ("status","processing_lease_expires_at");--> statement-breakpoint
ALTER TABLE "disclosure_log" ADD CONSTRAINT "disclosure_log_dedupe_key_unique" UNIQUE("dedupe_key");