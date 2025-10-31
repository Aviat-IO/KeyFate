-- Add GDPR-related audit event types to the enum
-- This migration adds enum values for data export and account deletion events

-- Note: PostgreSQL doesn't support IF NOT EXISTS before 9.3, but we're on a newer version
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'data_export_requested';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'data_export_downloaded';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'account_deletion_requested';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'account_deletion_confirmed';
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'account_deletion_cancelled';
