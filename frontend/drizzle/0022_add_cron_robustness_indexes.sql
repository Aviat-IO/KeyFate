-- Migration: Add performance indexes for cron robustness improvements
-- Purpose: Optimize grace period queries and exponential backoff logic
-- Created: 2024-11-23

-- Index for reminder grace period queries (check-secrets cron)
-- Optimizes: fetchPendingReminders() and handleMissedReminders()
-- Pattern: WHERE status IN ('pending', 'failed') AND scheduled_for BETWEEN x AND y
CREATE INDEX IF NOT EXISTS "reminder_jobs_status_scheduled_idx" 
ON "reminder_jobs" ("status", "scheduled_for") 
WHERE status IN ('pending', 'failed');

-- Index for exponential backoff queries (process-reminders cron)
-- Optimizes: Query with status='active', next_check_in < now, and last_retry_at checks
-- Pattern: WHERE status = 'active' AND next_check_in < now AND last_retry_at conditions
CREATE INDEX IF NOT EXISTS "secrets_status_checkin_retry_idx" 
ON "secrets" ("status", "next_check_in", "last_retry_at", "retry_count")
WHERE status = 'active';

-- Add comment for documentation
COMMENT ON INDEX "reminder_jobs_status_scheduled_idx" IS 'Optimizes grace period and missed reminder detection queries';
COMMENT ON INDEX "secrets_status_checkin_retry_idx" IS 'Optimizes exponential backoff queries for secret disclosure retries';
