-- Fix create_check_in_token function to properly reference gen_random_bytes
-- The function was trying to call public.gen_random_bytes but pgcrypto is in extensions schema

CREATE OR REPLACE FUNCTION create_check_in_token(
  p_secret_id UUID,
  p_expires_in INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TEXT
SECURITY DEFINER
SET search_path = 'public, extensions'
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

  -- Generate a secure random token using gen_random_bytes from extensions schema
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Insert the token
  INSERT INTO public.check_in_tokens (
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

-- Grant execute to service_role and authenticated
GRANT EXECUTE ON FUNCTION create_check_in_token TO service_role, authenticated;
