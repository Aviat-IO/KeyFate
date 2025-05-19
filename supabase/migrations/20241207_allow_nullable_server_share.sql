-- Allow server_share, iv, and auth_tag to be nullable
-- This supports the functionality to delete the server's share for additional security

ALTER TABLE public.secrets 
ALTER COLUMN server_share DROP NOT NULL;

ALTER TABLE public.secrets 
ALTER COLUMN iv DROP NOT NULL;

ALTER TABLE public.secrets 
ALTER COLUMN auth_tag DROP NOT NULL; 
