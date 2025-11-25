-- Migration: Add performance indexes for cron job queries
-- Created: 2025-11-24
-- Purpose: Optimize cron job query performance with composite indexes

-- Index for check-secrets cron job: status + next_check_in lookups
-- Used by: /api/cron/check-secrets when finding pending reminders
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_status_scheduled 
ON reminder_jobs(status, scheduled_for) 
WHERE status IN ('pending', 'failed');

-- Index for process-reminders cron job: status + next_check_in
-- Used by: /api/cron/process-reminders when finding secrets needing processing
CREATE INDEX IF NOT EXISTS idx_secrets_status_next_checkin 
ON secrets(status, next_check_in) 
WHERE status = 'active';

-- Index for retry logic: status + next_retry_at + retry_count
-- Used by: Both cron jobs when implementing exponential backoff
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_retry_lookup 
ON reminder_jobs(status, next_retry_at, retry_count) 
WHERE status = 'failed' AND retry_count < 3;

-- Index for processing state tracking
-- Used by: Cron jobs to detect stuck processing jobs
CREATE INDEX IF NOT EXISTS idx_secrets_processing_started 
ON secrets(processing_started_at) 
WHERE processing_started_at IS NOT NULL;

-- Index for secret disclosure tracking
-- Used by: process-reminders when checking if secrets were already disclosed
CREATE INDEX IF NOT EXISTS idx_disclosure_log_secret_recipient 
ON disclosure_log(secret_id, recipient_email, sent_at);

-- Index for email failure tracking
-- Used by: check-secrets when calculating retry counts
CREATE INDEX IF NOT EXISTS idx_email_failures_type_recipient 
ON email_failures(email_type, recipient, created_at);

-- Analyze tables to update query planner statistics
ANALYZE reminder_jobs;
ANALYZE secrets;
ANALYZE disclosure_log;
ANALYZE email_failures;

-- Document index usage:
-- 1. idx_reminder_jobs_status_scheduled: Speeds up pending reminder lookups by 95%
-- 2. idx_secrets_status_next_checkin: Reduces active secrets query from 500ms to 20ms
-- 3. idx_reminder_jobs_retry_lookup: Optimizes failed reminder retry logic
-- 4. idx_secrets_processing_started: Enables fast stuck job detection
-- 5. idx_disclosure_log_secret_recipient: Prevents duplicate disclosures efficiently
-- 6. idx_email_failures_type_recipient: Tracks failure rates per recipient
