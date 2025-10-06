-- Add unique constraint to prevent duplicate reminders
-- This ensures only one 'sent' reminder per (secret_id, reminder_type) combination

-- First, remove any existing duplicates (if any)
DELETE FROM reminder_jobs
WHERE id NOT IN (
  SELECT MIN(id)
  FROM reminder_jobs
  WHERE status = 'sent'
  GROUP BY secret_id, reminder_type
);

-- Add partial unique index (only for 'sent' status)
-- This allows multiple 'pending' or 'failed' records but only one 'sent' record
CREATE UNIQUE INDEX IF NOT EXISTS reminder_jobs_unique_sent
ON reminder_jobs (secret_id, reminder_type)
WHERE status = 'sent';

-- Add comment explaining the constraint
COMMENT ON INDEX reminder_jobs_unique_sent IS
  'Ensures only one sent reminder per (secret_id, reminder_type) combination. Allows multiple pending/failed reminders.';
