-- Drop the existing index that uses is_active
DROP INDEX IF EXISTS idx_secrets_trigger_check;

-- Create new index using status instead
CREATE INDEX IF NOT EXISTS idx_secrets_trigger_check 
ON secrets (status, is_triggered, next_check_in)
WHERE
  status = 'active'
  AND is_triggered = false;

-- Remove the is_active column
ALTER TABLE secrets DROP COLUMN IF EXISTS is_active; 
