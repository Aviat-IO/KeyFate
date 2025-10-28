# GDPR Compliance

## Overview

This capability implements GDPR-compliant data export and account deletion
functionality, ensuring compliance with EU data protection regulations (Articles
15, 17, and 20).

**Related capabilities:**

- `user-management` - User account lifecycle
- `audit-logging` - Audit trail for compliance
- `authentication` - Security for sensitive operations

## ADDED Requirements

### REQ-GDPR-001: Data Export Request

Users must be able to request a complete export of their personal data in a
machine-readable format (JSON).

**Priority:** High\
**Type:** Functional

#### Scenario: User requests data export

```gherkin
GIVEN user is authenticated and email is verified
WHEN user clicks "Export My Data" in settings
THEN system creates an export job
AND user receives a job ID
AND system sends email when export is ready
AND export file is available for 24 hours
```

#### Scenario: Rate limiting data export requests

```gherkin
GIVEN user has requested a data export in the last 24 hours
WHEN user attempts another export request
THEN system returns 429 Too Many Requests
AND error message explains 24-hour cooldown period
```

### REQ-GDPR-002: Data Export Contents

Exported data must include all personal information stored by the system in
machine-readable JSON format.

**Priority:** High\
**Type:** Functional

**Data included:**

- User profile (email, name, created date, email verified status)
- All secrets (title, content, encrypted content, check-in interval, status)
- Recipients (name, email) for each secret
- Server shares (if Pro user)
- Check-in history (timestamps)
- Audit logs (user actions with timestamps)
- Subscription information (plan, status, dates)
- Payment history (transaction IDs, amounts, dates - no card details)

#### Scenario: Export includes all user data

```gherkin
GIVEN user has 3 secrets, 5 recipients, and 10 check-ins
WHEN export is generated
THEN JSON file includes:
  - user profile object
  - array of 3 secrets with encrypted content
  - array of 5 recipients
  - array of 10 check-in records
  - audit log array
  - subscription object (if exists)
  - payment history array
```

### REQ-GDPR-003: Export File Security

Export files must be securely stored and accessed with time-limited signed URLs.

**Priority:** High\
**Type:** Security

**Security requirements:**

- Signed URLs with 24-hour expiration
- Maximum 3 downloads per export
- Files auto-deleted after 7 days
- Export only accessible by requesting user
- HTTPS-only downloads

#### Scenario: Export download expires after 24 hours

```gherkin
GIVEN user requested export 25 hours ago
WHEN user attempts to download export
THEN system returns 410 Gone
AND error message explains link expired
AND user must request new export
```

#### Scenario: Export limited to 3 downloads

```gherkin
GIVEN user has downloaded export 3 times
WHEN user attempts 4th download
THEN system returns 403 Forbidden
AND error message explains download limit reached
```

### REQ-GDPR-004: Account Deletion Request

Users must be able to request permanent deletion of their account and all
associated data, with a 30-day grace period.

**Priority:** High\
**Type:** Functional

**Deletion process:**

1. User requests deletion (requires OTP re-authentication)
2. System sends confirmation email with token
3. User clicks confirmation link
4. 30-day grace period starts
5. User receives reminder emails (7 days, 1 day before deletion)
6. After 30 days, account is permanently deleted
7. User receives deletion confirmation email

#### Scenario: User initiates account deletion

```gherkin
GIVEN user is authenticated
AND user provides valid OTP re-authentication token
WHEN user clicks "Delete My Account"
AND confirms deletion in dialog
THEN system creates deletion request
AND sends confirmation email
AND shows grace period start date (30 days from now)
```

#### Scenario: User confirms deletion request

```gherkin
GIVEN user received deletion confirmation email
WHEN user clicks confirmation link
THEN system marks deletion as confirmed
AND sends "grace period started" email
AND shows scheduled deletion date in settings
AND provides cancellation option
```

### REQ-GDPR-005: Deletion Grace Period

Users must be able to cancel account deletion during the 30-day grace period.

**Priority:** High\
**Type:** Functional

#### Scenario: User cancels deletion during grace period

```gherkin
GIVEN user has confirmed deletion request 15 days ago
AND grace period has not expired
WHEN user clicks "Cancel Deletion" in settings
THEN system cancels deletion request
AND sends cancellation confirmation email
AND account remains active
AND user can continue using service
```

#### Scenario: Deletion executes after grace period

```gherkin
GIVEN user confirmed deletion 30 days ago
AND grace period has expired
WHEN system runs daily deletion job
THEN all user data is permanently deleted
AND user receives deletion completion email
AND user cannot log in anymore
```

### REQ-GDPR-006: Data Deletion Scope

Account deletion must remove all user data except legally required records.

**Priority:** High\
**Type:** Functional

**Data deleted:**

- User profile record
- All secrets (encrypted content, metadata)
- All recipients
- All server shares
- Check-in history
- Audit logs
- OTP tokens
- Rate limit records
- Export jobs
- Webhook events

**Data retained (legal requirement):**

- Payment transaction records (7 years for tax compliance)
- Anonymized subscription metadata

#### Scenario: Deletion cascades to all related data

```gherkin
GIVEN user has:
  - 5 secrets
  - 10 recipients
  - 3 server shares
  - 50 audit log entries
  - 2 export jobs
WHEN account deletion executes
THEN database contains:
  - 0 user records for this user
  - 0 secrets for this user
  - 0 recipients for this user's secrets
  - 0 server shares for this user
  - 0 audit logs for this user
  - 0 export jobs for this user
AND payment records remain (anonymized)
```

### REQ-GDPR-007: Deletion Audit Trail

All deletion requests must be auditable for compliance purposes.

**Priority:** Medium\
**Type:** Compliance

**Audit events:**

- Deletion request initiated (timestamp, user ID)
- Confirmation email sent (timestamp)
- Deletion confirmed (timestamp, confirmation token)
- Grace period started (timestamp, scheduled deletion date)
- Cancellation requested (timestamp, if applicable)
- Deletion executed (timestamp, data deleted)

#### Scenario: Deletion audit trail is complete

```gherkin
GIVEN user completed account deletion
WHEN compliance officer reviews audit logs
THEN audit trail shows:
  - Deletion request timestamp
  - Confirmation email timestamp
  - Confirmation timestamp
  - Grace period start timestamp
  - Scheduled deletion timestamp
  - Actual deletion timestamp
  - Data deletion confirmation
```

### REQ-GDPR-008: Export Background Processing

Data export generation must be processed asynchronously to avoid request
timeouts.

**Priority:** Medium\
**Type:** Technical

**Processing flow:**

1. User requests export → job created (status: pending)
2. Cron job picks up pending jobs every 15 minutes
3. System generates export file
4. File uploaded to Cloud Storage
5. Job status updated to completed
6. Email sent to user with download link

#### Scenario: Export processes in background

```gherkin
GIVEN user requested export 5 minutes ago
WHEN cron job runs
THEN system:
  - Finds pending export job
  - Generates JSON data export
  - Uploads to Cloud Storage
  - Updates job status to completed
  - Records file URL and size
  - Sends "export ready" email
```

### REQ-GDPR-009: API Authentication and Authorization

All GDPR endpoints must require authentication and verify user authorization.

**Priority:** High\
**Type:** Security

**Security requirements:**

- All endpoints require valid session
- Export endpoints require email verification
- Deletion endpoints require OTP re-authentication
- Users can only access their own data
- CSRF protection on all state-changing endpoints
- Rate limiting on all endpoints

#### Scenario: Unauthorized export access blocked

```gherkin
GIVEN user A created export job with ID "abc123"
AND user B is authenticated
WHEN user B attempts to download export "abc123"
THEN system returns 403 Forbidden
AND error message says "Not authorized"
```

#### Scenario: Deletion requires re-authentication

```gherkin
GIVEN user is authenticated
AND user has not provided OTP re-authentication token
WHEN user attempts to request account deletion
THEN system returns 403 Forbidden
AND response includes code "REAUTH_REQUIRED"
AND error message explains OTP required
```

### REQ-GDPR-010: Email Notifications

System must send email notifications for all critical GDPR operations.

**Priority:** Medium\
**Type:** Functional

**Email types:**

- Export ready (with download link, 24-hour expiration notice)
- Deletion confirmation request (with confirmation link)
- Grace period started (with scheduled date, cancellation link)
- Deletion reminder (7 days before, 1 day before)
- Deletion complete (confirmation of deletion)
- Deletion cancelled (confirmation of cancellation)

#### Scenario: User receives export ready email

```gherkin
GIVEN export job completed successfully
WHEN system sends notification email
THEN email includes:
  - Download link with 24-hour expiration
  - File size information
  - Security warning about not sharing link
  - Explanation of data included
  - Link expires in: timestamp
```

## Integration Points

### Database Schema

**New tables:**

```sql
CREATE TABLE data_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  file_size BIGINT,
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE TABLE account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  confirmation_token TEXT UNIQUE NOT NULL,
  confirmation_sent_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  scheduled_deletion_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_export_jobs_user_status ON data_export_jobs(user_id, status);
CREATE INDEX idx_deletion_requests_user_status ON account_deletion_requests(user_id, status);
CREATE INDEX idx_deletion_requests_scheduled ON account_deletion_requests(scheduled_deletion_at)
  WHERE status = 'confirmed' AND deleted_at IS NULL;
```

### API Endpoints

**Data Export:**

- `POST /api/user/export-data` - Create export job
- `GET /api/user/export-data/:jobId` - Get export status/download

**Account Deletion:**

- `DELETE /api/user/delete-account` - Initiate deletion
- `POST /api/user/delete-account/confirm` - Confirm deletion
- `POST /api/user/delete-account/cancel/:requestId` - Cancel deletion
- `GET /api/user/deletion-status/:requestId` - Get deletion status

**Cron Jobs:**

- `POST /api/cron/process-exports` - Generate pending exports (every 15 min)
- `POST /api/cron/process-deletions` - Execute expired deletions (daily)
- `POST /api/cron/cleanup-exports` - Delete old exports (daily)

## Testing Requirements

### Unit Tests

- Export service generates correct JSON structure
- Deletion service cascades to all related tables
- Grace period calculation is accurate
- Rate limiting enforces 24-hour cooldown
- Signed URL generation and validation

### Integration Tests

- Full export flow (request → generate → download)
- Full deletion flow (request → confirm → execute)
- Cancellation during grace period
- Authorization checks (user can't access other users' data)
- CSRF protection
- Re-authentication requirement

### Security Tests

- Export files not accessible without signed URL
- Signed URLs expire after 24 hours
- Download count limit enforced (3 downloads)
- Deletion requires OTP re-authentication
- Audit trail for all operations

## Performance Requirements

- Export generation: < 60 seconds for 95th percentile
- Export file size: < 100MB for typical user
- Deletion execution: < 10 seconds for 95th percentile
- API response time: < 500ms for status checks
- Concurrent exports: Support 100 simultaneous exports

## Compliance Notes

- **GDPR Article 15**: Right to access implemented via data export
- **GDPR Article 17**: Right to erasure implemented via account deletion
- **GDPR Article 20**: Data portability via machine-readable JSON export
- **Payment records**: Retained for 7 years per tax regulations (EU, US)
- **Audit trail**: All operations logged for compliance audits
