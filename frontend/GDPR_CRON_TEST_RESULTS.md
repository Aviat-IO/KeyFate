# GDPR Cron Jobs - Staging Test Results

**Date:** October 30, 2025  
**Environment:** Staging (localhost:54321 proxy to staging DB)  
**Status:** ✅ Ready for testing

---

## Setup Complete

### ✅ Database Migration Applied
- Migration `0020_gdpr_compliance.sql` applied successfully
- Tables created:
  - `data_export_jobs` 
  - `account_deletion_requests`
- Indexes created for performance
- Foreign key constraints established

### ✅ Test Data Created

Created test data for user: `accolver@gmail.com`

1. **Pending Export Job**
   - ID: `85d36295-2365-4f19-a637-07ec5574ef57`
   - Status: `pending`
   - Ready for `process-exports` cron

2. **Expired Export Job** 
   - ID: `c948c3cf-0a71-4d7f-b83d-40313b21ec4d`
   - Status: `completed`
   - Expired: 1 hour ago
   - Ready for `cleanup-exports` cron

3. **Deletion Request**
   - ID: `760bdcda-aec7-41a2-ae08-520b56cb8f54`
   - Status: `confirmed`
   - Scheduled: 1 hour ago (past grace period)
   - ⚠️ Ready for `process-deletions` cron (WILL DELETE USER)

---

## How to Test (Choose One Method)

### Method 1: Google Cloud Scheduler (Recommended)

```bash
# Set your project
export PROJECT_ID="your-staging-project-id"
export REGION="us-central1"  # or your scheduler region

# Test process-exports
gcloud scheduler jobs run keyfate-process-exports-staging \
  --project=$PROJECT_ID \
  --location=$REGION

# Test cleanup-exports
gcloud scheduler jobs run keyfate-cleanup-exports-staging \
  --project=$PROJECT_ID \
  --location=$REGION

# Test process-deletions (⚠️ DESTRUCTIVE)
gcloud scheduler jobs run keyfate-process-deletions-staging \
  --project=$PROJECT_ID \
  --location=$REGION
```

### Method 2: Direct API Call with cURL

```bash
# Get CRON_SECRET from Doppler or terraform.tfvars
export CRON_SECRET="your-cron-secret-here"
export STAGING_URL="https://staging.keyfate.com"

# Test process-exports
curl -X POST "$STAGING_URL/api/cron/process-exports" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

# Test cleanup-exports  
curl -X POST "$STAGING_URL/api/cron/cleanup-exports" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

# Test process-deletions (⚠️ DESTRUCTIVE)
curl -X POST "$STAGING_URL/api/cron/process-deletions" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v
```

---

## Expected Results

### process-exports Cron

**Expected Response:**
```json
{
  "success": true,
  "processed": 1,
  "successCount": 1,
  "failureCount": 0
}
```

**Expected Behavior:**
1. Finds pending export job `85d36295...`
2. Changes status to `processing`
3. Generates complete user data export (user, secrets, audit logs, etc.)
4. Uploads JSON file to Cloud Storage (`keyfate-exports-staging` bucket)
5. Generates signed URL (24hr expiry)
6. Updates job:
   - Status: `completed`
   - `file_url`: signed URL
   - `file_size`: bytes
   - `completed_at`: timestamp
7. Sends email to `accolver@gmail.com` with download link

**Verify:**
```bash
node test-gdpr-staging.js
# Should show 1 completed export, 0 pending
```

---

### cleanup-exports Cron

**Expected Response:**
```json
{
  "success": true,
  "cleaned": 1,
  "errors": 0
}
```

**Expected Behavior:**
1. Finds expired export job `c948c3cf...`
2. Deletes file from Cloud Storage (may 404 if not uploaded, that's OK)
3. Deletes database record from `data_export_jobs`

**Verify:**
```bash
node test-gdpr-staging.js
# Should show 0 expired exports
```

---

### process-deletions Cron

**Expected Response:**
```json
{
  "success": true,
  "processed": 1,
  "successCount": 1,
  "failureCount": 0
}
```

**Expected Behavior:**
1. Finds deletion request `760bdcda...` (confirmed + past scheduled date)
2. Executes `executeAccountDeletion()` for user `accolver@gmail.com`
3. Deletes all user data in order:
   - Email failures
   - Secret recipients
   - Secrets
   - Check-in history
   - Audit logs
   - Export jobs
   - OTP rate limits
   - Sessions
   - OAuth accounts
   - Verification tokens
   - Password reset tokens
   - User record
4. Anonymizes subscriptions (keeps for financial records)
5. Updates deletion request status to `completed`
6. Sends final email to `accolver@gmail.com`

**⚠️ WARNING:** This will permanently delete user `accolver@gmail.com` and all their data!

**Verify:**
```sql
-- User should be deleted
SELECT * FROM users WHERE email = 'accolver@gmail.com';
-- Should return 0 rows

-- Deletion request should be completed
SELECT * FROM account_deletion_requests WHERE id = '760bdcda...';
-- Should show status = 'completed', deleted_at populated
```

---

## Monitoring Commands

### View Cloud Scheduler Logs
```bash
gcloud logging read "resource.type=cloud_scheduler_job" \
  --project=$PROJECT_ID \
  --limit=20 \
  --format="table(timestamp,textPayload)"
```

### View Cloud Run Application Logs
```bash
gcloud logs read "resource.type=cloud_run_revision AND textPayload=~'CRON'" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,textPayload)"
```

### Database Verification
```bash
# Run test script
node test-gdpr-staging.js

# Or query directly
node check-migrations.js
```

---

## Rollback / Cleanup Test Data

If you want to remove the test data WITHOUT running the crons:

```sql
-- Remove test export jobs
DELETE FROM data_export_jobs 
WHERE user_id = 'b560b28c-77e5-4b7d-9a75-2c8bb5b6dd6f';

-- Remove test deletion request
DELETE FROM account_deletion_requests 
WHERE user_id = 'b560b28c-77e5-4b7d-9a75-2c8bb5b6dd6f';
```

---

## Success Criteria

- [ ] process-exports creates export file in Cloud Storage
- [ ] User receives "Your Data Export is Ready" email
- [ ] Export download link works and returns valid JSON
- [ ] Export contains all expected data fields
- [ ] cleanup-exports deletes expired files and DB records
- [ ] process-deletions removes all user data
- [ ] Final "Account Deleted" email sent
- [ ] All cron jobs return 200 OK
- [ ] No errors in Cloud Run logs
- [ ] Cloud Scheduler shows successful execution

---

## Next Steps

1. **Run tests** using one of the methods above
2. **Check logs** for any errors
3. **Verify results** using the verification commands
4. **Document any issues** found
5. **Test cancellation flow** (optional - create another deletion request and cancel it)

---

## Files Created

- `test-gdpr-staging.js` - Database connectivity and status checker
- `test-gdpr-e2e.js` - Test data creator
- `apply-gdpr-migration.js` - Manual migration applier
- `check-migrations.js` - Migration history checker

Run these with: `node <filename>.js`
