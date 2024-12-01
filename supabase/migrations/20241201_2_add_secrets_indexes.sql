-- Add indexes for the columns we frequently query
CREATE INDEX IF NOT EXISTS idx_secrets_trigger_check 
ON secrets (is_active, is_triggered, next_check_in)
WHERE is_active = true AND is_triggered = false; 
