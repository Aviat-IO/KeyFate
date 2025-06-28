-- Create check-in tokens table
CREATE TABLE check_in_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for token lookups
CREATE INDEX idx_check_in_tokens_token ON check_in_tokens(token);

-- Create RLS policies
ALTER TABLE check_in_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own tokens
CREATE POLICY "Users can view their own tokens"
  ON check_in_tokens
  FOR SELECT
  USING (
    secret_id IN (
      SELECT id FROM secrets WHERE user_id = (select auth.uid())
    )
  );

-- Function to create a check-in token
CREATE OR REPLACE FUNCTION create_check_in_token(
  p_secret_id UUID,
  p_expires_in INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TEXT
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_role TEXT;
BEGIN
  -- Get the current role
  SELECT current_setting('request.jwt.claims', true)::json->>'role' INTO v_role;

  -- Verify the caller has appropriate role
  IF v_role IS NULL OR v_role != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized. Only service_role can create check-in tokens.';
  END IF;

  -- Generate a secure random token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Insert the token
  INSERT INTO check_in_tokens (
    secret_id,
    token,
    expires_at
  ) VALUES (
    p_secret_id,
    v_token,
    CURRENT_TIMESTAMP + p_expires_in
  );

  RETURN v_token;
END;
$$;

-- Grant execute to service_role and authenticated (service_role will be checked inside the function)
GRANT EXECUTE ON FUNCTION create_check_in_token TO service_role, authenticated;
