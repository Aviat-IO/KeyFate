CREATE TABLE IF NOT EXISTS "privacy_policy_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "privacy_policy_acceptances" ADD CONSTRAINT "privacy_policy_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_acceptances_user_id_idx" ON "privacy_policy_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_acceptances_accepted_at_idx" ON "privacy_policy_acceptances" USING btree ("accepted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secrets_user_id_status_idx" ON "secrets" USING btree ("user_id","status");