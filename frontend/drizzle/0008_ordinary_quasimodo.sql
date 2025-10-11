CREATE TYPE "public"."audit_event_category" AS ENUM('secrets', 'authentication', 'subscriptions', 'settings', 'recipients');--> statement-breakpoint
CREATE TYPE "public"."audit_event_type" AS ENUM('secret_created', 'secret_edited', 'secret_deleted', 'check_in', 'secret_triggered', 'recipient_added', 'recipient_removed', 'settings_changed', 'login', 'subscription_changed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"event_category" "audit_event_category" NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_event_type_idx" ON "audit_logs" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
ALTER TABLE "secret_recipients" DROP COLUMN IF EXISTS "is_primary";