# Add GDPR Compliance (Data Export & Deletion)

## Why

As a service handling user data in the EU and globally, we must comply with GDPR
regulations that grant users the right to:

1. **Right to Access (Art. 15)**: Export their personal data in a portable
   format
2. **Right to Erasure (Art. 17)**: Request deletion of their personal data
3. **Right to Data Portability (Art. 20)**: Receive data in machine-readable
   format

Non-compliance risks significant fines (up to €20M or 4% of annual turnover) and
loss of user trust. This capability implements the technical infrastructure to
support these legal requirements.

## What Changes

### New API Endpoints

- `POST /api/user/export-data` - Initiate user data export (async job)
- `GET /api/user/export-data/:jobId` - Check export job status and download
- `DELETE /api/user/delete-account` - Request account deletion (with
  verification)
- `GET /api/user/deletion-status/:requestId` - Check deletion job status

### New Database Tables

- `data_export_jobs` - Track export requests and file URLs
- `account_deletion_requests` - Track deletion requests with grace period

### Data Export Contents (JSON format)

- User profile (email, name, created date)
- All secrets (metadata + encrypted content)
- Check-in history
- Audit logs (user actions)
- Subscription and payment history
- Server shares (if Pro user)

### Account Deletion Process

1. **Grace Period**: 30-day cooling-off period before permanent deletion
2. **Cascade Deletion**: Removes all user data (secrets, recipients, shares,
   audit logs)
3. **Payment Records**: Retain for 7 years (legal requirement)
4. **Email Notification**: Confirm deletion request and completion

## Impact

- **Affected specs:**
  - **NEW**: `gdpr-compliance` (data export/deletion)
  - **MODIFIED**: `user-management` (account lifecycle)
  - **MODIFIED**: `audit-logging` (export audit logs)
- **Affected code:**
  - `frontend/src/app/api/user/export-data/` - Data export endpoints (NEW)
  - `frontend/src/app/api/user/delete-account/` - Account deletion endpoint
    (NEW)
  - `frontend/src/lib/gdpr/` - GDPR service layer (NEW)
  - `frontend/src/components/settings/` - Settings UI for data management
    (MODIFIED)
  - `frontend/drizzle/` - Database migrations for new tables (NEW)
- **Breaking changes:** None (new endpoints only)

- **Dependencies:**
  - Cloud Storage (Google Cloud Storage or S3) for temporary export files
  - Background job system (consider BullMQ or Cloud Tasks)
  - Email service for deletion confirmation
- **Timeline:** 4-6 days
  - Day 1-2: Database schema, export service implementation
  - Day 3-4: Deletion service, grace period logic
  - Day 5: UI integration, testing
  - Day 6: Security review, documentation

## Security Considerations

- **Authentication**: Require active session + OTP re-authentication
- **Export Security**:
  - Signed URLs with 24-hour expiration
  - One-time download tracking
  - Delete export files after 7 days
- **Deletion Verification**:
  - Require email confirmation
  - 30-day grace period (cancellable)
  - Audit trail of deletion requests
- **Data Retention**: Maintain payment records for 7 years (legal compliance)

## Acceptance Criteria

- [ ] User can request data export from settings page
- [ ] Export includes all user data in machine-readable JSON format
- [ ] Export download expires after 24 hours
- [ ] User can request account deletion with email confirmation
- [ ] Deletion has 30-day grace period before permanent removal
- [ ] User can cancel deletion request during grace period
- [ ] All user data (except payment records) is deleted after grace period
- [ ] Audit logs track all export and deletion requests
- [ ] API endpoints have proper authentication and rate limiting
- [ ] Email notifications sent for export ready and deletion confirmation
