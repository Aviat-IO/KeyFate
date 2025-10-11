-- Migration: Remove primary recipient designation
-- All recipients are treated equally

-- Drop is_primary column from secret_recipients table
ALTER TABLE "secret_recipients" DROP COLUMN IF EXISTS "is_primary";

-- Remove any indexes that reference is_primary
DROP INDEX IF EXISTS "idx_secret_recipients_primary";
