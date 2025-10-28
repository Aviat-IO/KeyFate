-- Production Security Hardening Migration
-- Adds privacy policy acceptance table and performance indexes

-- Create privacy policy acceptance table (Task 4.3.1)
CREATE TABLE IF NOT EXISTS "privacy_policy_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text
);

-- Add composite index on secrets(userId, status) for tier limit queries (Task 1.2.7)
CREATE INDEX IF NOT EXISTS "secrets_user_status_idx" ON "secrets" ("user_id", "status");

-- Add index on privacy policy acceptance for lookups
CREATE INDEX IF NOT EXISTS "privacy_policy_acceptance_user_idx" ON "privacy_policy_acceptance" ("user_id");
