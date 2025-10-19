CREATE INDEX IF NOT EXISTS "check_in_tokens_secret_valid_idx" ON "check_in_tokens" USING btree ("secret_id","used_at","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_failures_recipient_type_idx" ON "email_failures" USING btree ("recipient","email_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_jobs_secret_reminder_status_idx" ON "reminder_jobs" USING btree ("secret_id","reminder_type","status","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminder_jobs_status_retry_idx" ON "reminder_jobs" USING btree ("status","retry_count","next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unique_secret_reminder_scheduled" ON "reminder_jobs" USING btree ("secret_id","reminder_type","scheduled_for");