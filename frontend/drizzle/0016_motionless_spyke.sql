CREATE TYPE "public"."token_purpose" AS ENUM('email_verification', 'authentication');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otp_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD COLUMN "purpose" "token_purpose" DEFAULT 'email_verification';--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD COLUMN "attempt_count" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otp_rate_limits_email_window" ON "otp_rate_limits" USING btree ("email","window_end");