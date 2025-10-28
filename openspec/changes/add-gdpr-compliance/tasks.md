# Implementation Tasks: GDPR Compliance

## Phase 1: Database Infrastructure (Day 1)

- [ ] Create database migration `0019_gdpr_compliance.sql`
- [ ] Add `data_export_jobs` table:
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `status` (enum: pending, processing, completed, failed)
  - `file_url` (text, nullable)
  - `file_size` (bigint, nullable)
  - `download_count` (integer, default 0)
  - `expires_at` (timestamp)
  - `created_at` (timestamp)
  - `completed_at` (timestamp, nullable)
  - `error_message` (text, nullable)
- [ ] Add `account_deletion_requests` table:
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `status` (enum: pending, cancelled, completed)
  - `confirmation_token` (text, unique)
  - `confirmation_sent_at` (timestamp)
  - `confirmed_at` (timestamp, nullable)
  - `scheduled_deletion_at` (timestamp)
  - `cancelled_at` (timestamp, nullable)
  - `deleted_at` (timestamp, nullable)
  - `created_at` (timestamp)
- [ ] Add indexes on `user_id` and `status` columns
- [ ] Test migration in local environment

## Phase 2: Data Export Service (Day 2)

- [ ] Create `frontend/src/lib/gdpr/export-service.ts`
- [ ] Implement `generateUserDataExport(userId: string)` function:
  - [ ] Export user profile data
  - [ ] Export all secrets (with encrypted content)
  - [ ] Export recipients
  - [ ] Export server shares
  - [ ] Export check-in history
  - [ ] Export audit logs for user
  - [ ] Export subscription data
  - [ ] Export payment history (metadata only, not card details)
- [ ] Implement `uploadExportFile(userId: string, data: object)` function:
  - [ ] Generate JSON file
  - [ ] Upload to Cloud Storage with signed URL
  - [ ] Set 7-day auto-deletion policy
  - [ ] Return signed URL with 24-hour expiration
- [ ] Add `recordExportJob(userId, fileUrl, fileSize)` database function
- [ ] Add unit tests for export service (85%+ coverage)

## Phase 3: Data Export API Endpoints (Day 2)

- [ ] Create `frontend/src/app/api/user/export-data/route.ts` (POST):
  - [ ] Validate authentication (requireAuth)
  - [ ] Require email verification
  - [ ] Check for existing pending export (rate limit: 1 per 24 hours)
  - [ ] Create export job record
  - [ ] Trigger async export generation
  - [ ] Return job ID
  - [ ] Add CSRF protection
  - [ ] Add audit log entry
- [ ] Create `frontend/src/app/api/user/export-data/[jobId]/route.ts` (GET):
  - [ ] Validate authentication
  - [ ] Check job belongs to current user
  - [ ] Return job status and download URL (if ready)
  - [ ] Track download count (limit: 3 downloads per export)
  - [ ] Add audit log entry for downloads
- [ ] Add rate limiting (5 requests per hour)
- [ ] Add integration tests for export endpoints

## Phase 4: Account Deletion Service (Day 3)

- [ ] Create `frontend/src/lib/gdpr/deletion-service.ts`
- [ ] Implement `initiateAccountDeletion(userId: string)` function:
  - [ ] Generate confirmation token
  - [ ] Create deletion request record
  - [ ] Set scheduled_deletion_at to now + 30 days
  - [ ] Send confirmation email with cancellation link
  - [ ] Return request ID
- [ ] Implement `confirmAccountDeletion(token: string)` function:
  - [ ] Validate token
  - [ ] Update confirmed_at timestamp
  - [ ] Send "grace period started" email
- [ ] Implement `cancelAccountDeletion(requestId: string)` function:
  - [ ] Validate request belongs to user
  - [ ] Update status to cancelled
  - [ ] Send cancellation confirmation email
- [ ] Implement `executeAccountDeletion(userId: string)` function:
  - [ ] Delete all secrets (cascade to recipients, shares)
  - [ ] Delete audit logs
  - [ ] Delete export jobs
  - [ ] Delete OTP tokens
  - [ ] Delete rate limit records
  - [ ] Delete webhook events
  - [ ] Anonymize subscription records (keep payment metadata)
  - [ ] Delete user record
  - [ ] Send deletion completion email (before deleting user)
- [ ] Add unit tests for deletion service

## Phase 5: Account Deletion API Endpoints (Day 3)

- [ ] Create `frontend/src/app/api/user/delete-account/route.ts` (DELETE):
  - [ ] Validate authentication
  - [ ] Require OTP re-authentication (x-reauth-token header)
  - [ ] Check for existing pending deletion
  - [ ] Initiate deletion request
  - [ ] Add CSRF protection
  - [ ] Add audit log entry
  - [ ] Return request ID
- [ ] Create `frontend/src/app/api/user/delete-account/confirm/route.ts` (POST):
  - [ ] Validate confirmation token
  - [ ] Confirm deletion request
  - [ ] Return confirmation status
- [ ] Create
      `frontend/src/app/api/user/delete-account/cancel/[requestId]/route.ts`
      (POST):
  - [ ] Validate authentication
  - [ ] Validate request belongs to user
  - [ ] Cancel deletion request
  - [ ] Add audit log entry
- [ ] Create `frontend/src/app/api/user/deletion-status/[requestId]/route.ts`
      (GET):
  - [ ] Validate authentication
  - [ ] Return deletion request status
- [ ] Add integration tests for deletion endpoints

## Phase 6: Background Job Processing (Day 4)

- [ ] Create `frontend/src/app/api/cron/process-exports/route.ts`:
  - [ ] Find pending export jobs
  - [ ] Generate and upload data export
  - [ ] Update job status to completed
  - [ ] Send "export ready" email
  - [ ] Add HMAC authentication
- [ ] Create `frontend/src/app/api/cron/process-deletions/route.ts`:
  - [ ] Find confirmed deletions past grace period
  - [ ] Execute account deletion
  - [ ] Update deletion status to completed
  - [ ] Add HMAC authentication
- [ ] Create `frontend/src/app/api/cron/cleanup-exports/route.ts`:
  - [ ] Find export jobs older than 7 days
  - [ ] Delete files from Cloud Storage
  - [ ] Delete database records
  - [ ] Add HMAC authentication
- [ ] Add Cloud Scheduler jobs (or GitHub Actions cron):
  - [ ] Process exports: every 15 minutes
  - [ ] Process deletions: daily at 2 AM UTC
  - [ ] Cleanup exports: daily at 3 AM UTC

## Phase 7: Frontend UI (Day 5)

- [ ] Create `frontend/src/components/settings/DataManagement.tsx`:
  - [ ] "Export My Data" button
  - [ ] Show export job status and download link
  - [ ] "Delete My Account" button (with warning dialog)
  - [ ] Show active deletion request with cancellation option
- [ ] Update `frontend/src/app/(app)/settings/page.tsx`:
  - [ ] Add "Data & Privacy" section
  - [ ] Integrate DataManagement component
- [ ] Create deletion confirmation dialog:
  - [ ] Explain 30-day grace period
  - [ ] Explain data that will be deleted
  - [ ] Explain data retention (payment records)
  - [ ] Require OTP re-authentication
  - [ ] Show cancellation instructions
- [ ] Add loading states and error handling
- [ ] Add accessibility (ARIA labels, keyboard navigation)

## Phase 8: Email Templates (Day 5)

- [ ] Create `exportReady` email template:
  - [ ] Subject: "Your Data Export is Ready"
  - [ ] Include download link with 24-hour expiration
  - [ ] Explain file format (JSON)
  - [ ] Security notice about not sharing link
- [ ] Create `deletionConfirmation` email template:
  - [ ] Subject: "Confirm Your Account Deletion Request"
  - [ ] Include confirmation link
  - [ ] Explain 30-day grace period
  - [ ] Include cancellation instructions
- [ ] Create `deletionGracePeriod` email template:
  - [ ] Subject: "Your Account Will Be Deleted in 30 Days"
  - [ ] Show scheduled deletion date
  - [ ] Include cancellation link
  - [ ] List what data will be deleted
- [ ] Create `deletionComplete` email template:
  - [ ] Subject: "Your Account Has Been Deleted"
  - [ ] Confirm deletion completion
  - [ ] Thank user for using the service

## Phase 9: Testing & Security (Day 6)

- [ ] Unit tests for all services (85%+ coverage)
- [ ] Integration tests for all API endpoints
- [ ] Test export file contents (validate all data included)
- [ ] Test deletion cascade (verify all data removed)
- [ ] Test grace period cancellation
- [ ] Test rate limiting on export endpoint
- [ ] Test re-authentication requirement for deletion
- [ ] Security review:
  - [ ] Verify CSRF protection on all endpoints
  - [ ] Verify authentication on all endpoints
  - [ ] Verify authorization (user can only access own data)
  - [ ] Verify signed URLs expire correctly
  - [ ] Verify deletion confirmation tokens are secure
- [ ] Load test export generation (handle 100 concurrent exports)
- [ ] Test export file cleanup (7-day retention)

## Phase 10: Documentation (Day 6)

- [ ] Update `docs/gdpr-compliance.md`:
  - [ ] User guide for data export
  - [ ] User guide for account deletion
  - [ ] Technical architecture overview
  - [ ] API endpoint documentation
- [ ] Update Privacy Policy (legal team)
- [ ] Update Terms of Service (legal team)
- [ ] Add in-app help text for data management features

## Phase 11: Deployment (Post-Implementation)

- [ ] Run database migration in staging
- [ ] Test full flow in staging
- [ ] Set up Cloud Scheduler jobs in staging
- [ ] Verify export file storage and cleanup
- [ ] Run database migration in production
- [ ] Deploy API endpoints to production
- [ ] Deploy frontend UI to production
- [ ] Set up Cloud Scheduler jobs in production
- [ ] Monitor export and deletion jobs for 48 hours
- [ ] Update incident response playbook

## Success Metrics

- [ ] Export generation completes within 60 seconds (95th percentile)
- [ ] Export files contain all expected data fields
- [ ] Zero data leaks (user can only access own data)
- [ ] Deletion removes 100% of user data (except payment records)
- [ ] Zero failed deletions due to cascade constraints
- [ ] 100% email delivery rate for notifications
