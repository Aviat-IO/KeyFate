# Staging Environment Issues - Diagnostic Report

**Date**: 2025-10-03
**Environment**: staging.keyfate.com
**Investigated by**: Claude (TDD Feature Implementation Agent)

---

## Problem Summary

### Issue 1: Email Delivery Failure
- **Status**: Cron jobs execute successfully but no emails sent
- **Impact**: No reminder emails reaching users
- **Root Cause**: Missing SendGrid configuration in infrastructure

### Issue 2: Database Appears Empty via Cloud SQL Proxy
- **Status**: App functions correctly, but DBeaver shows empty tables
- **Impact**: Cannot inspect staging data for debugging
- **Root Cause**: Likely connection to wrong database or schema

---

## Issue 1: Email Delivery Failure

### Current State Analysis

#### Infrastructure Configuration
**Location**: `infrastructure/apps/secrets.tf`

**Secrets Configured** (via `gcloud secrets list`):
```
✅ database-url
✅ encryption-key
✅ google-client-id
✅ google-client-secret
✅ nextauth-secret
✅ stripe-secret-key
✅ btcpay-api-key
✅ btcpay-store-id
✅ btcpay-webhook-secret
✅ cron-authentication-secret-staging
❌ SENDGRID_API_KEY - NOT FOUND
❌ SENDGRID_ADMIN_EMAIL - NOT FOUND
❌ SENDGRID_SENDER_NAME - NOT FOUND
```

**Frontend Environment Variables** (`infrastructure/apps/frontend.tf`):
- Lines 150-173: Standard env vars configured
- Lines 174-216: Secret Manager references
- **Missing**: No SendGrid secrets referenced in `env_from_key`

#### Application Code Analysis

**Email Service** (`frontend/src/lib/email/email-service.ts`):
- **Provider**: SendGrid (via nodemailer)
- **Configuration Requirements**:
  - `SENDGRID_API_KEY` (required)
  - `SENDGRID_ADMIN_EMAIL` (required)
  - `SENDGRID_SENDER_NAME` (optional, defaults to "Dead Man's Switch")
- **Fallback**: Development mode logs to console if vars missing
- **Current Behavior**: In staging (production mode), throws error if vars missing

**Validation Function** (`email-service.ts:80-121`):
```typescript
export async function validateEmailConfig(): Promise<ConfigValidationResult> {
  const missingVars: string[] = [];
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!process.env.SENDGRID_API_KEY) {
    missingVars.push("SENDGRID_API_KEY");
  }
  if (!process.env.SENDGRID_ADMIN_EMAIL) {
    missingVars.push("SENDGRID_ADMIN_EMAIL");
  }

  // In development, allow fallback to console logging
  if (isDevelopment && missingVars.length > 0) {
    return { valid: true, provider: "console-dev", missingVars: [], developmentMode: true };
  }

  if (missingVars.length > 0) {
    return { valid: false, provider: "sendgrid", missingVars };
  }
  // ...
}
```

**Cron Job Implementation** (`frontend/src/app/api/cron/process-reminders/route.ts`):
- **Current**: Lines 44-47 - Only reports count, no actual email sending
- **Missing**: Integration with email service
- **Result**: Cron succeeds but does nothing

```typescript
// For now, just report counts. Actual email sending logic can be added here or via services.
return NextResponse.json({
  processed: due.length,
  timestamp: new Date().toISOString()
});
```

### Root Cause

**Primary**: SendGrid credentials not configured in Secret Manager or Terraform
**Secondary**: Cron job placeholder code doesn't actually send emails

### Impact Assessment

- **Severity**: HIGH - Core feature non-functional
- **User Impact**: No reminder emails = users won't know to check in
- **Business Impact**: Secrets may trigger unexpectedly without warnings
- **Data Loss Risk**: Low - data intact, only notification failure

---

## Issue 2: Database Appears Empty via Cloud SQL Proxy

### Current State Analysis

#### Cloud SQL Configuration
**Instance**: `keyfate-dev:us-central1:keyfate-postgres-staging`
**Proxy Command** (from Makefile:252-257):
```bash
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging
```

#### Connection Methods

**Application Connection** (Cloud Run):
- **Method**: Unix socket via Cloud SQL Proxy sidecar
- **Path**: `/cloudsql/keyfate-dev:us-central1:keyfate-postgres-staging`
- **Database**: From SECRET `database-url` in Secret Manager
- **Status**: ✅ Working (app functions correctly)

**DBeaver Connection** (via make db-proxy-staging):
- **Method**: TCP via local Cloud SQL Proxy
- **Host**: localhost:54321
- **Database**: Unknown - user-configured in DBeaver
- **Status**: ❌ Shows empty tables

#### Database Connection Parsing

**Code Location**: `frontend/src/lib/db/connection.ts:19-61`

Unix socket format parsing:
```typescript
if (connectionString && connectionString.includes("/cloudsql/")) {
  // Format: postgresql://username:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE

  const usernameMatch = connectionString.match(/^postgresql:\/\/([^:]+):/);
  const dbHostMatch = connectionString.match(/@\/([^?]+)\?host=([^&\s]+)/);
  const database = dbHostMatch ? dbHostMatch[1] : '';
  const host = dbHostMatch ? dbHostMatch[2] : '';
  // ...
}
```

### Likely Root Causes

1. **Wrong Database Name in DBeaver**
   - App uses database name from SECRET `database-url`
   - DBeaver connection may use default `postgres` or incorrect name
   - **Action Needed**: Check actual database name in secret

2. **Schema Mismatch**
   - Tables might be in non-`public` schema
   - DBeaver default schema view may differ
   - **Action Needed**: Check schema configuration

3. **Connection String Mismatch**
   - Different username/database in secret vs. DBeaver config
   - **Action Needed**: Extract actual connection details from secret

4. **Multiple Databases on Instance**
   - Instance might have multiple databases
   - Proxy connects to instance, but database selection differs
   - **Action Needed**: List databases on instance

### Impact Assessment

- **Severity**: MEDIUM - Developer tooling issue, not production impact
- **User Impact**: None - app works correctly
- **Developer Impact**: HIGH - Cannot inspect staging data
- **Debugging Impact**: Difficult to troubleshoot issues without data access

---

## Recommended Investigation Steps

### Email Delivery (Priority: HIGH)

1. **Check Secret Manager for database-url content**
   ```bash
   gcloud secrets versions access latest --secret=database-url --project=keyfate-dev
   ```
   This reveals the actual database name being used by the app

2. **Create SendGrid API Key**
   - Log into SendGrid account
   - Generate new API key with full mail send permissions
   - Note sender email address for SENDGRID_ADMIN_EMAIL

3. **Add SendGrid Secrets to GCP**
   ```bash
   # Create secrets
   echo -n "YOUR_API_KEY" | gcloud secrets create sendgrid-api-key \
     --data-file=- --project=keyfate-dev

   echo -n "your-sender@email.com" | gcloud secrets create sendgrid-admin-email \
     --data-file=- --project=keyfate-dev

   echo -n "KeyFate Notifications" | gcloud secrets create sendgrid-sender-name \
     --data-file=- --project=keyfate-dev
   ```

4. **Update Terraform Configuration**
   - Add secrets to `infrastructure/apps/secrets.tf`
   - Add env_from_key references in `infrastructure/apps/frontend.tf`
   - Grant service account access to secrets

5. **Implement Email Sending in Cron**
   - Update `process-reminders/route.ts` to actually send emails
   - Use `sendReminderEmail()` from email-service
   - Add error handling and logging

6. **Deploy and Test**
   ```bash
   cd infrastructure
   terraform apply
   # Trigger cron manually to test
   ```

### Database Access (Priority: MEDIUM)

1. **Get actual DATABASE_URL from Secret Manager**
   ```bash
   gcloud secrets versions access latest --secret=database-url --project=keyfate-dev
   ```
   Extract: username, password, database name

2. **List databases on Cloud SQL instance**
   ```bash
   gcloud sql databases list --instance=keyfate-postgres-staging --project=keyfate-dev
   ```

3. **Verify DBeaver connection settings**
   - Host: localhost
   - Port: 54321
   - Database: (use exact name from DATABASE_URL secret)
   - Username: (use exact name from DATABASE_URL secret)
   - Password: (use exact password from DATABASE_URL secret)
   - Schema: public (or check for other schemas)

4. **Test connection via psql first**
   ```bash
   # Start proxy
   make db-proxy-staging

   # In another terminal
   psql -h localhost -p 54321 -U <username> -d <database_name>
   \dt  # List tables
   \dn  # List schemas
   ```

5. **Check for RLS (Row Level Security) policies**
   - May need to set user context
   - Check `frontend/src/lib/db/connection.ts:210-216` for `setUserContext`

---

## Testing Validation

### Email Delivery Tests

1. **Verify SendGrid credentials configured**
   ```bash
   gcloud secrets list --project=keyfate-dev | grep sendgrid
   ```

2. **Check Cloud Run environment has vars**
   ```bash
   gcloud run services describe keyfate-frontend-staging \
     --region=us-central1 --project=keyfate-dev \
     --format="value(spec.template.spec.containers[0].env)"
   ```

3. **Trigger cron job manually**
   ```bash
   curl -X POST https://staging.keyfate.com/api/cron/process-reminders \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

4. **Check logs for email sending**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision \
     AND resource.labels.service_name=keyfate-frontend-staging \
     AND textPayload=~'email'" \
     --limit=50 --project=keyfate-dev
   ```

### Database Access Tests

1. **Verify database exists**
   ```bash
   gcloud sql databases list --instance=keyfate-postgres-staging --project=keyfate-dev
   ```

2. **Test direct connection**
   ```bash
   make db-proxy-staging &
   PGPASSWORD=<password> psql -h localhost -p 54321 -U <username> -d <database_name> -c "\dt"
   ```

3. **Check table count**
   ```sql
   SELECT schemaname, tablename
   FROM pg_tables
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
   ```

---

## Implementation Plan

### Phase 1: Email Delivery Fix (Immediate)

**Task 1.1**: Create SendGrid secrets in GCP
- Create API key in SendGrid dashboard
- Add three secrets to Secret Manager
- Grant service account access

**Task 1.2**: Update Terraform configuration
- Add sendgrid secrets to `secrets.tf`
- Add env_from_key in `frontend.tf`
- Apply infrastructure changes

**Task 1.3**: Implement email sending in cron
- Update `process-reminders/route.ts`
- Add `sendReminderEmail()` calls
- Add error handling and retry logic

**Task 1.4**: Test end-to-end
- Deploy updated code
- Trigger cron manually
- Verify email received

### Phase 2: Database Access Fix (Follow-up)

**Task 2.1**: Extract connection details from secret
- Get DATABASE_URL from Secret Manager
- Parse username, password, database name
- Document for team reference

**Task 2.2**: Configure DBeaver correctly
- Use exact connection details from secret
- Test connection
- Verify tables visible

**Task 2.3**: Document connection process
- Update README with connection instructions
- Add troubleshooting guide
- Share with team

---

## Next Steps

1. **Immediate**: Confirm user has SendGrid account and can generate API key
2. **Priority**: Begin Phase 1 implementation (email delivery)
3. **Research**: Use Context7 for SendGrid + Cloud Run best practices
4. **Testing**: Apply TDD methodology for cron job email implementation
5. **Documentation**: Update deployment docs with email configuration requirements

---

## Technical Debt Notes

1. **Cron Jobs**: Placeholder code with TODOs - needs full implementation
2. **Email Service**: Well-structured but not integrated with cron jobs
3. **Infrastructure**: Missing email service configuration in IaC
4. **Monitoring**: No email delivery tracking or alerting configured
5. **Testing**: No integration tests for email delivery in staging

---

## References

- **Email Service**: `frontend/src/lib/email/email-service.ts`
- **Email Templates**: `frontend/src/lib/email/templates.ts`
- **Cron Jobs**: `frontend/src/app/api/cron/process-reminders/route.ts`
- **DB Connection**: `frontend/src/lib/db/connection.ts`
- **Infrastructure Secrets**: `infrastructure/apps/secrets.tf`
- **Frontend Config**: `infrastructure/apps/frontend.tf`
- **Makefile Targets**: Lines 252-265 (db-proxy commands)
