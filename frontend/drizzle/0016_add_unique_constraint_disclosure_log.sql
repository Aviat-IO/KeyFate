-- Add unique constraint to prevent duplicate sent disclosures
-- This runs AFTER cleanup script (0015)

CREATE UNIQUE INDEX IF NOT EXISTS "disclosure_log_unique_sent_idx"
  ON "disclosure_log"("secret_id", "recipient_email")
  WHERE status = 'sent';
