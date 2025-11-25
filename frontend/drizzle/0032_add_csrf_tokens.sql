-- Migration: Add CSRF token storage
-- Purpose: Implement comprehensive CSRF protection with token-based validation
-- Related: Security Audit Issue #9

CREATE TABLE IF NOT EXISTS "csrf_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for efficient lookups and cleanup
CREATE INDEX IF NOT EXISTS "idx_csrf_tokens_session" ON "csrf_tokens" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_csrf_tokens_token" ON "csrf_tokens" ("token");
CREATE INDEX IF NOT EXISTS "idx_csrf_tokens_expires" ON "csrf_tokens" ("expires_at");

-- Comment for documentation
COMMENT ON TABLE "csrf_tokens" IS 'Stores one-time CSRF tokens with 1-hour expiration for state-changing operations';
