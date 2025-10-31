-- GDPR Compliance Migration
-- Adds tables for data export jobs and account deletion requests

-- Data export jobs table
CREATE TABLE IF NOT EXISTS "data_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
	"file_url" text,
	"file_size" bigint,
	"download_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text
);

-- Account deletion requests table
CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
	"confirmation_token" text UNIQUE NOT NULL,
	"confirmation_sent_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"scheduled_deletion_at" timestamp,
	"cancelled_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Foreign key constraints
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_user_id_fkey" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_fkey" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_export_jobs_user_status" ON "data_export_jobs"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_user_status" ON "account_deletion_requests"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_deletion_requests_scheduled" ON "account_deletion_requests"("scheduled_deletion_at")
	WHERE status = 'confirmed' AND deleted_at IS NULL;
