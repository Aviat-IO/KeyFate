-- Migration: Cron Security and Performance Fixes
-- Date: 2025-10-19
-- Purpose: Add unique constraints, indexes, and retry logic for cron jobs

-- 1. Add retry_count and next_retry_at columns to reminder_jobs for retry logic
ALTER TABLE reminder_jobs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;

-- 2. Add unique constraint to prevent duplicate reminders in same check-in period
-- We'll use (secret_id, reminder_type, scheduled_for) as the unique combination
-- This prevents race conditions where multiple cron instances try to send the same reminder
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_jobs_unique_per_checkin 
ON reminder_jobs(secret_id, reminder_type, scheduled_for)
WHERE status IN ('pending', 'sent');

-- 3. Add composite index for hasReminderBeenSent query performance
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_lookup 
ON reminder_jobs(secret_id, reminder_type, status, sent_at DESC)
WHERE status = 'sent';

-- 4. Add index for retry query
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_retry 
ON reminder_jobs(status, next_retry_at, retry_count)
WHERE status = 'failed' AND retry_count < 3;

-- 5. Create disclosure_log table for tracking secret disclosures
CREATE TABLE IF NOT EXISTS disclosure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Add unique constraint to prevent duplicate disclosures to same recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_disclosure_log_unique_per_recipient 
ON disclosure_log(secret_id, recipient_email)
WHERE status = 'sent';

-- 7. Add index for disclosure log queries
CREATE INDEX IF NOT EXISTS idx_disclosure_log_lookup 
ON disclosure_log(secret_id, status);

-- 8. Add processing state columns to secrets table for idempotent disclosure
ALTER TABLE secrets
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 9. Add index for process-reminders cron query (overdue secrets)
CREATE INDEX IF NOT EXISTS idx_secrets_overdue 
ON secrets(status, next_check_in)
WHERE status = 'active';

-- 10. Add index for check-secrets cron query (active secrets)
CREATE INDEX IF NOT EXISTS idx_secrets_active_checkin 
ON secrets(status, next_check_in, last_check_in)
WHERE status = 'active' AND server_share IS NOT NULL;
