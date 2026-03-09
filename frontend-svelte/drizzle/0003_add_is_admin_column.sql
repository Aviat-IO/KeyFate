ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "disclosure_log" DROP CONSTRAINT "disclosure_log_secret_id_secrets_id_fk";
--> statement-breakpoint
DROP INDEX "idx_bitcoin_utxos_tx";--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ALTER COLUMN "amount_sats" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "disclosure_log" ALTER COLUMN "secret_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disclosure_log" ALTER COLUMN "retry_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limits" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_jobs" ALTER COLUMN "retry_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ALTER COLUMN "retry_count" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_log" ADD CONSTRAINT "disclosure_log_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_checkin_history_secret_id" ON "checkin_history" USING btree ("secret_id");--> statement-breakpoint
CREATE INDEX "idx_checkin_history_user_id" ON "checkin_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_notifications_secret_id" ON "email_notifications" USING btree ("secret_id");--> statement-breakpoint
CREATE INDEX "idx_privacy_policy_acceptance_user_id" ON "privacy_policy_acceptance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_secret_recipients_secret_id" ON "secret_recipients" USING btree ("secret_id");--> statement-breakpoint
CREATE INDEX "idx_user_contact_methods_user_id" ON "user_contact_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_provider_customer_id" ON "user_subscriptions" USING btree ("provider_customer_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_provider_subscription_id" ON "user_subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD CONSTRAINT "unique_bitcoin_utxos_tx_output" UNIQUE("tx_id","output_index");