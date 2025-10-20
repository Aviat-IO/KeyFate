-- Pre-migration cleanup: Find and remove duplicate sent disclosures
-- This must run BEFORE adding the unique constraint

-- Step 1: Identify duplicates (for audit log)
-- Uncomment to see duplicates before deletion:
-- SELECT secret_id, recipient_email, COUNT(*) as count
-- FROM disclosure_log
-- WHERE status = 'sent'
-- GROUP BY secret_id, recipient_email
-- HAVING COUNT(*) > 1;

-- Step 2: Delete duplicate sent disclosures, keeping only the oldest one
DELETE FROM disclosure_log
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY secret_id, recipient_email
             ORDER BY created_at ASC
           ) as rn
    FROM disclosure_log
    WHERE status = 'sent'
  ) t
  WHERE rn > 1
);
