# Database Schema Analysis & Optimization

## Current State Assessment

### ✅ Good Practices Already in Place

1. **Foreign Keys Present:**
   - All child tables have proper FK constraints with CASCADE deletes where appropriate
   - `secrets.userId` → `users.id` (CASCADE)
   - `secretRecipients.secretId` → `secrets.id` (CASCADE)
   - `accounts.userId` → `users.id` (CASCADE)
   - `sessions.userId` → `users.id` (CASCADE)
   - `userSubscriptions.userId` → `users.id` (CASCADE)
   - `paymentHistory.userId` → `users.id` (CASCADE)

2. **Primary Keys:**
   - All tables have proper primary keys (UUID or text-based)
   - Compound keys used where appropriate (accounts, verificationTokens)

3. **Unique Constraints:**
   - `users.email` - UNIQUE
   - `sessions.sessionToken` - UNIQUE
   - `checkInTokens.token` - UNIQUE
   - `webhookEvents.eventId` - UNIQUE
   - `subscriptionTiers.name` - UNIQUE
   - `userSubscriptions.userId` - UNIQUE (one subscription per user)

4. **Enums for Type Safety:**
   - All status fields use PostgreSQL enums
   - Prevents invalid data at database level

### ⚠️ Missing Indexes (Performance Issues)

#### Critical Indexes Needed:

1. **secrets table queries:**
   ```sql
   -- Frequently queried by userId for dashboard
   CREATE INDEX idx_secrets_user_id ON secrets(user_id);
   
   -- Filtered by status in many queries
   CREATE INDEX idx_secrets_status ON secrets(status);
   
   -- Used for check-in scheduling
   CREATE INDEX idx_secrets_next_check_in ON secrets(next_check_in) 
   WHERE next_check_in IS NOT NULL AND is_triggered = false;
   
   -- Composite for user's active secrets (most common query)
   CREATE INDEX idx_secrets_user_status ON secrets(user_id, status);
   ```

2. **secretRecipients table queries:**
   ```sql
   -- Always queried by secretId
   CREATE INDEX idx_secret_recipients_secret_id ON secret_recipients(secret_id);
   
   -- Used to find primary recipient
   CREATE INDEX idx_secret_recipients_primary ON secret_recipients(secret_id, is_primary)
   WHERE is_primary = true;
   ```

3. **reminderJobs table queries:**
   ```sql
   -- Cron job queries pending reminders by scheduled time
   CREATE INDEX idx_reminder_jobs_scheduled ON reminder_jobs(scheduled_for, status)
   WHERE status = 'pending';
   
   -- Queried by secret for reminder management
   CREATE INDEX idx_reminder_jobs_secret_id ON reminder_jobs(secret_id);
   ```

4. **checkinHistory table queries:**
   ```sql
   -- Queried by secret to show history
   CREATE INDEX idx_checkin_history_secret_id ON checkin_history(secret_id);
   
   -- Queried by user to show their activity
   CREATE INDEX idx_checkin_history_user_id ON checkin_history(user_id);
   
   -- Composite for secret history sorted by date
   CREATE INDEX idx_checkin_history_secret_date ON checkin_history(secret_id, checked_in_at DESC);
   ```

5. **emailNotifications table queries:**
   ```sql
   -- Queried by secret for audit trail
   CREATE INDEX idx_email_notifications_secret_id ON email_notifications(secret_id);
   
   -- Future: queried by recipient
   CREATE INDEX idx_email_notifications_recipient_id ON email_notifications(recipient_id)
   WHERE recipient_id IS NOT NULL;
   
   -- Used for debugging failed emails
   CREATE INDEX idx_email_notifications_failed ON email_notifications(failed_at)
   WHERE failed_at IS NOT NULL;
   ```

6. **webhookEvents table queries:**
   ```sql
   -- Processing webhooks by status
   CREATE INDEX idx_webhook_events_status ON webhook_events(status, created_at)
   WHERE status IN ('received', 'retrying');
   
   -- Querying by provider and type
   CREATE INDEX idx_webhook_events_provider_type ON webhook_events(provider, event_type);
   ```

7. **paymentHistory table queries:**
   ```sql
   -- User's payment history
   CREATE INDEX idx_payment_history_user_id ON payment_history(user_id, created_at DESC);
   
   -- Subscription payment tracking
   CREATE INDEX idx_payment_history_subscription_id ON payment_history(subscription_id)
   WHERE subscription_id IS NOT NULL;
   ```

8. **emailFailures table queries:**
   ```sql
   -- Unresolved failures for monitoring
   CREATE INDEX idx_email_failures_unresolved ON email_failures(created_at DESC)
   WHERE resolved_at IS NULL;
   
   -- Failures by type for analytics
   CREATE INDEX idx_email_failures_type ON email_failures(email_type, created_at DESC);
   ```

9. **checkInTokens table queries:**
   ```sql
   -- Looking up tokens (already unique, but can optimize)
   -- Token already has unique index
   
   -- Find tokens for a secret
   CREATE INDEX idx_check_in_tokens_secret_id ON check_in_tokens(secret_id);
   
   -- Cleanup expired tokens
   CREATE INDEX idx_check_in_tokens_expires ON check_in_tokens(expires_at)
   WHERE used_at IS NULL;
   ```

### 🔧 Schema Normalization Issues

#### Issue 1: emailNotifications Missing Recipient Reference
**Current:**
```typescript
emailNotifications {
  recipientEmail: text // Just a string, no FK
  secretId: uuid
}
```

**Problem:** Can't track which recipient received which email

**Fix:**
```typescript
emailNotifications {
  recipientId: uuid | null, // FK to secret_recipients
  recipientEmail: text | null, // Keep for backward compat
  secretId: uuid
}
```

#### Issue 2: adminNotifications Missing User Reference
**Current:**
```typescript
adminNotifications {
  acknowledgedBy: text // Just text, not FK
}
```

**Concern:** Should this reference `users.id`?

**Analysis:** If `acknowledgedBy` stores username/email, it's fine. If it stores user ID, should be FK.

**Recommendation:** Convert to FK if storing user ID:
```typescript
acknowledgedBy: text("acknowledged_by").references(() => users.id)
```

#### Issue 3: No Constraints on Secret Recipients
**Current:** No constraint preventing multiple primary recipients per secret

**Fix:** Add unique constraint:
```sql
CREATE UNIQUE INDEX idx_secret_recipients_one_primary 
ON secret_recipients(secret_id) 
WHERE is_primary = true;
```

This ensures exactly one primary recipient per secret.

### 📊 Query Pattern Analysis

Based on code analysis, here are the most common queries:

1. **Get user's secrets** (Dashboard):
   ```sql
   SELECT * FROM secrets WHERE user_id = ? ORDER BY created_at DESC
   ```
   **Needs:** `idx_secrets_user_id`

2. **Get secret with recipients** (View page):
   ```sql
   SELECT s.*, sr.* 
   FROM secrets s 
   LEFT JOIN secret_recipients sr ON sr.secret_id = s.id 
   WHERE s.id = ? AND s.user_id = ?
   ```
   **Needs:** `idx_secret_recipients_secret_id`

3. **Process pending reminders** (Cron):
   ```sql
   SELECT * FROM reminder_jobs 
   WHERE status = 'pending' 
   AND scheduled_for <= NOW()
   ORDER BY scheduled_for
   ```
   **Needs:** `idx_reminder_jobs_scheduled`

4. **Check-in history** (Secret view):
   ```sql
   SELECT * FROM checkin_history 
   WHERE secret_id = ? 
   ORDER BY checked_in_at DESC
   ```
   **Needs:** `idx_checkin_history_secret_date`

5. **User's subscription** (Tier checking):
   ```sql
   SELECT us.*, st.* 
   FROM user_subscriptions us 
   JOIN subscription_tiers st ON st.id = us.tier_id 
   WHERE us.user_id = ?
   ```
   **Needs:** Already has unique index on userId

### 🎯 Recommended Index Priority

**Priority 1 (Critical for Performance):**
1. `idx_secrets_user_id` - Dashboard loads
2. `idx_secret_recipients_secret_id` - Every secret view
3. `idx_reminder_jobs_scheduled` - Cron performance
4. `idx_checkin_history_secret_date` - Secret history

**Priority 2 (High Impact):**
5. `idx_secrets_user_status` - Filtered secret lists
6. `idx_email_notifications_secret_id` - Audit trails
7. `idx_webhook_events_status` - Webhook processing
8. `idx_payment_history_user_id` - Payment history

**Priority 3 (Nice to Have):**
9. `idx_email_failures_unresolved` - Monitoring
10. `idx_check_in_tokens_secret_id` - Token lookups
11. Remaining indexes from analysis above

### 🔐 Data Integrity Constraints

#### Missing CHECK Constraints:

1. **Secret recipients must have contact info:**
   ```sql
   ALTER TABLE secret_recipients
   ADD CONSTRAINT check_has_contact_info
   CHECK (email IS NOT NULL OR phone IS NOT NULL);
   ```

2. **Reminder scheduling logic:**
   ```sql
   ALTER TABLE reminder_jobs
   ADD CONSTRAINT check_scheduled_future
   CHECK (scheduled_for > created_at);
   ```

3. **Check-in intervals are positive:**
   ```sql
   ALTER TABLE secrets
   ADD CONSTRAINT check_checkin_days_positive
   CHECK (check_in_days > 0);
   ```

4. **SSS threshold <= shares total:**
   ```sql
   ALTER TABLE secrets
   ADD CONSTRAINT check_sss_threshold_valid
   CHECK (sss_threshold <= sss_shares_total);
   ```

### 📈 Estimated Performance Impact

**Without Indexes:**
- Dashboard with 100 secrets: ~500ms (full table scan)
- Secret view with 5 recipients: ~100ms (sequential scan)
- Cron job with 1000 pending reminders: ~2s (full table scan)

**With Indexes:**
- Dashboard with 100 secrets: ~10ms (index scan)
- Secret view with 5 recipients: ~5ms (index seek)
- Cron job with 1000 pending reminders: ~50ms (index scan)

**~10-40x performance improvement expected**

### 🚀 Implementation Strategy

1. **Create indexes in development** - Test query performance
2. **Measure before/after** - Use EXPLAIN ANALYZE
3. **Deploy to staging** - Monitor impact
4. **Deploy to production** - Apply during low-traffic window
5. **Monitor metrics** - Track query performance improvements

### 📝 Summary of Changes Needed

**Migrations to Create:**
1. `0006_set_primary_recipients.sql` - Ensure one primary per secret
2. `0007_add_recipient_to_email_notifications.sql` - Add recipientId FK
3. `0008_add_critical_indexes.sql` - Priority 1 & 2 indexes
4. `0009_add_data_constraints.sql` - CHECK constraints
5. `0010_add_optimization_indexes.sql` - Priority 3 indexes
