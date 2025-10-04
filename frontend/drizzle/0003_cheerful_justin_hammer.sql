CREATE TYPE "public"."email_failure_provider" AS ENUM('sendgrid', 'console-dev', 'resend');--> statement-breakpoint
CREATE TYPE "public"."email_failure_type" AS ENUM('reminder', 'disclosure', 'admin_notification', 'verification');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_type" "email_failure_type" NOT NULL,
	"provider" "email_failure_provider" NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"error_message" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
