ALTER TYPE "public"."subscription_tier" ADD VALUE 'pro' BEFORE 'premium';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secret_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secret_recipients" ADD CONSTRAINT "secret_recipients_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "secrets" DROP COLUMN IF EXISTS "recipient_name";--> statement-breakpoint
ALTER TABLE "secrets" DROP COLUMN IF EXISTS "recipient_email";--> statement-breakpoint
ALTER TABLE "secrets" DROP COLUMN IF EXISTS "recipient_phone";--> statement-breakpoint
ALTER TABLE "secrets" DROP COLUMN IF EXISTS "contact_method";