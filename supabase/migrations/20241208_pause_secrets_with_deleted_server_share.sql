-- Pause any existing secrets that have null server_share
-- This ensures consistency with the new behavior where deleting server share automatically pauses the secret

UPDATE public.secrets 
SET status = 'paused'
WHERE server_share IS NULL 
  AND status != 'paused'
  AND status != 'triggered';

-- Add a comment explaining the change
COMMENT ON COLUMN public.secrets.server_share IS 'Encrypted server share for Shamir Secret Sharing. When null, the secret is effectively disabled and should be paused.'; 
