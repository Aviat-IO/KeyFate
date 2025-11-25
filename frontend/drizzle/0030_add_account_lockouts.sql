-- Migration: Add account lockout mechanism
-- Purpose: Implement progressive account lockout to prevent brute force attacks
-- Related: Security Audit Issue #6

CREATE TABLE IF NOT EXISTS "account_lockouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp,
  "permanently_locked" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_account_lockouts_email" ON "account_lockouts" ("email");
CREATE INDEX IF NOT EXISTS "idx_account_lockouts_locked_until" ON "account_lockouts" ("locked_until") WHERE "locked_until" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_account_lockouts_permanently_locked" ON "account_lockouts" ("permanently_locked") WHERE "permanently_locked" = true;

-- Comment for documentation
COMMENT ON TABLE "account_lockouts" IS 'Tracks failed authentication attempts and implements progressive lockout: 5 attempts = 1h, 10 attempts = 24h, 20 attempts = permanent';
