# User Management (Delta)

## MODIFIED Requirements

### REQ-USER-003: Account Lifecycle (MODIFIED)

**ADDED:** Account deletion with grace period

Users can request permanent account deletion with a 30-day grace period during
which they can cancel the deletion request.

**Priority:** High\
**Type:** Functional

#### Scenario: User account deletion states

```gherkin
GIVEN user has active account
WHEN user requests deletion
THEN account enters "pending_deletion" state
AND scheduled_deletion_at is set to now + 30 days

GIVEN account is in "pending_deletion" state
AND grace period has not expired
WHEN user cancels deletion
THEN account returns to "active" state
AND scheduled_deletion_at is cleared

GIVEN account is in "pending_deletion" state
AND grace period has expired
WHEN deletion job runs
THEN account is permanently deleted
AND all related data is removed (except payment records)
```

## Integration Points

### Database Schema Changes

**Modified `users` table:**

```sql
ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'
  CHECK (account_status IN ('active', 'pending_deletion', 'deleted'));
ALTER TABLE users ADD COLUMN scheduled_deletion_at TIMESTAMP;
```

### API Changes

**New endpoints:**

- `DELETE /api/user/delete-account` - Initiate account deletion
- `POST /api/user/delete-account/cancel/:requestId` - Cancel deletion

**Modified behavior:**

- Login blocked for accounts in "pending_deletion" state
- Active sessions invalidated when deletion confirmed
- Subscription cancellation triggered on deletion request
