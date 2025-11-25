-- Migration: Add encryption key versioning to secrets table
-- Purpose: Enable safe encryption key rotation without data loss
-- Related: Security Audit Issue #5

ALTER TABLE "secrets" ADD COLUMN IF NOT EXISTS "key_version" integer DEFAULT 1;

-- Index for efficient lookups during key rotation
CREATE INDEX IF NOT EXISTS "idx_secrets_key_version" ON "secrets" ("key_version");

-- Comment for documentation
COMMENT ON COLUMN "secrets"."key_version" IS 'Version of encryption key used to encrypt this secret (enables key rotation)';
