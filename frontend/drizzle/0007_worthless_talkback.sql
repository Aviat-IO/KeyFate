ALTER TABLE "check_in_tokens" DROP CONSTRAINT "check_in_tokens_secret_id_secrets_id_fk";
--> statement-breakpoint
ALTER TABLE "checkin_history" DROP CONSTRAINT "checkin_history_secret_id_secrets_id_fk";
--> statement-breakpoint
ALTER TABLE "email_notifications" DROP CONSTRAINT "email_notifications_secret_id_secrets_id_fk";
--> statement-breakpoint
ALTER TABLE "reminder_jobs" DROP CONSTRAINT "reminder_jobs_secret_id_secrets_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_in_tokens" ADD CONSTRAINT "check_in_tokens_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checkin_history" ADD CONSTRAINT "checkin_history_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_jobs" ADD CONSTRAINT "reminder_jobs_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
