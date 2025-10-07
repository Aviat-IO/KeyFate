# Database Query Security Patterns

## Overview

After removing Supabase Row-Level Security (RLS) policies during the Cloud SQL migration, all data isolation and user filtering must be enforced at the application level. This document provides approved patterns for secure database queries.

## Critical Security Requirements

### 1. User Data Must Be Filtered by userId

All queries accessing user-owned data MUST include userId filtering to prevent cross-user data access.

### 2. Resource Ownership Must Be Validated

Operations on related resources (check-in tokens, reminder jobs) MUST validate ownership through the parent secret.

### 3. System Operations Require Special Handling

Admin and cron operations that legitimately need cross-user access MUST be properly authenticated and authorized.

---

## Table Filtering Requirements

### User Tables (MUST filter by userId)

These tables contain user-owned data and require userId filtering on ALL queries:

- **secrets** - User's dead man's switch secrets
- **checkin_history** - User's check-in records
- **user_subscriptions** - User's subscription data
- **user_contact_methods** - User's contact preferences
- **payment_history** - User's payment records

### Ownership Tables (MUST validate via join)

These tables are owned through a relationship and require validation:

- **check_in_tokens** - Validate via secret.userId
- **reminder_jobs** - Validate via secret.userId
- **email_notifications** - Validate via secret.userId

### System Tables (No user filter required)

These tables are for system/admin use only:

- **email_failures** - Admin monitoring only
- **admin_notifications** - Admin only
- **webhook_events** - System events
- **cron_config** - System configuration
- **subscription_tiers** - Public reference data

### NextAuth Tables (Framework-managed)

These tables are managed by NextAuth.js:

- **users** - User accounts
- **accounts** - OAuth provider accounts
- **sessions** - User sessions
- **verification_tokens** - Email verification

---

## Approved Query Patterns

### Pattern 1: Direct User Filtering

**Use Case**: Accessing user-owned data in the `secrets` table.

```typescript
// ✅ CORRECT: Filter by userId
const secret = await db
  .select()
  .from(secrets)
  .where(
    and(
      eq(secrets.id, secretId),
      eq(secrets.userId, userId) // REQUIRED
    )
  );

// ❌ WRONG: Missing userId filter
const secret = await db
  .select()
  .from(secrets)
  .where(eq(secrets.id, secretId)); // SECURITY VULNERABILITY!
```

### Pattern 2: Ownership Validation via Join

**Use Case**: Accessing check-in tokens that belong to a user's secret.

```typescript
// ✅ CORRECT: Validate ownership via join
const token = await db
  .select()
  .from(checkInTokens)
  .innerJoin(secrets, eq(checkInTokens.secretId, secrets.id))
  .where(
    and(
      eq(checkInTokens.id, tokenId),
      eq(secrets.userId, userId) // Validate ownership
    )
  );

// ❌ WRONG: No ownership validation
const token = await db
  .select()
  .from(checkInTokens)
  .where(eq(checkInTokens.id, tokenId)); // SECURITY VULNERABILITY!
```

### Pattern 3: Service Layer with userId Parameter

**Use Case**: Reusable service methods that enforce user filtering.

```typescript
// ✅ CORRECT: Service method requires userId
export async function getSecret(id: string, userId: string): Promise<Secret> {
  const db = await getDatabase();
  const [result] = await db
    .select()
    .from(secrets)
    .where(
      and(
        eq(secrets.id, id),
        eq(secrets.userId, userId) // Enforced at service layer
      )
    );

  return result;
}

// Usage in API route
const secret = await getSecret(secretId, session.user.id);

// ❌ WRONG: Service method missing userId parameter
export async function getSecret(id: string): Promise<Secret> {
  const db = await getDatabase();
  const [result] = await db
    .select()
    .from(secrets)
    .where(eq(secrets.id, id)); // SECURITY VULNERABILITY!

  return result;
}
```

### Pattern 4: Update Operations

**Use Case**: Updating user-owned data.

```typescript
// ✅ CORRECT: Include userId in WHERE clause
const result = await db
  .update(secrets)
  .set({ title: 'New Title' })
  .where(
    and(
      eq(secrets.id, secretId),
      eq(secrets.userId, userId) // Prevent updating other users' data
    )
  )
  .returning();

// Verify update succeeded
if (result.length === 0) {
  throw new Error('Secret not found or access denied');
}

// ❌ WRONG: Missing userId filter
const result = await db
  .update(secrets)
  .set({ title: 'New Title' })
  .where(eq(secrets.id, secretId)); // SECURITY VULNERABILITY!
```

### Pattern 5: Delete Operations

**Use Case**: Deleting user-owned data.

```typescript
// ✅ CORRECT: Include userId in WHERE clause
const result = await db
  .delete(secrets)
  .where(
    and(
      eq(secrets.id, secretId),
      eq(secrets.userId, userId) // Prevent deleting other users' data
    )
  )
  .returning({ id: secrets.id });

// Verify deletion succeeded
if (result.length === 0) {
  throw new Error('Secret not found or access denied');
}

// ❌ WRONG: Missing userId filter
const result = await db
  .delete(secrets)
  .where(eq(secrets.id, secretId)); // SECURITY VULNERABILITY!
```

### Pattern 6: List Operations

**Use Case**: Getting all records for a user.

```typescript
// ✅ CORRECT: Filter by userId
const userSecrets = await db
  .select()
  .from(secrets)
  .where(eq(secrets.userId, userId))
  .orderBy(desc(secrets.createdAt));

// ❌ WRONG: No userId filter
const allSecrets = await db
  .select()
  .from(secrets)
  .orderBy(desc(secrets.createdAt)); // Returns ALL users' data!
```

### Pattern 7: System Queries (Cron/Admin)

**Use Case**: System operations that legitimately need cross-user access.

```typescript
// ✅ CORRECT: System cron job with proper authentication
export async function POST(req: NextRequest) {
  // Authenticate with cron secret
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // System query - no userId filter needed
  const overdueSecrets = await db
    .select()
    .from(secrets)
    .where(
      and(
        eq(secrets.status, 'active'),
        lt(secrets.nextCheckIn, new Date())
      )
    );

  // Process all overdue secrets
  // ...
}

function authorize(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const token = header.slice(7).trim();
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}
```

### Pattern 8: Cascade Delete with Ownership

**Use Case**: Deleting a secret and all related data.

```typescript
// ✅ CORRECT: Validate ownership first, then cascade delete
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership FIRST
  const secret = await secretsService.getById(id, session.user.id);

  if (!secret) {
    return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
  }

  // Now safe to cascade delete
  const db = await getDatabase();

  await db.transaction(async (tx) => {
    await tx.delete(checkinHistory).where(eq(checkinHistory.secretId, id));
    await tx.delete(checkInTokens).where(eq(checkInTokens.secretId, id));
    await tx.delete(reminderJobs).where(eq(reminderJobs.secretId, id));
    await tx.delete(emailNotifications).where(eq(emailNotifications.secretId, id));

    // Final delete with userId filter for safety
    await tx.delete(secretsTable).where(
      and(
        eq(secretsTable.id, id),
        eq(secretsTable.userId, session.user.id)
      )
    );
  });

  return NextResponse.json({ success: true });
}
```

---

## API Route Patterns

### Standard User API Route

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Authenticate user
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Query with userId filter
    const secret = await secretsService.getById(id, session.user.id);

    // 3. Handle not found
    if (!secret) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    }

    // 4. Return data
    return NextResponse.json(secret);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Admin API Route

```typescript
export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify admin role
    const isAdmin = await validateAdminRole(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Admin query (no userId filter required)
    const emailFailures = await db
      .select()
      .from(emailFailures)
      .orderBy(desc(emailFailures.createdAt))
      .limit(100);

    return NextResponse.json(emailFailures);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Cron API Route

```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate with cron secret
    if (!authorize(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. System query (no userId filter)
    const overdueSecrets = await db
      .select()
      .from(secrets)
      .where(
        and(
          eq(secrets.status, 'active'),
          lt(secrets.nextCheckIn, new Date())
        )
      );

    // 3. Process system operation
    for (const secret of overdueSecrets) {
      // Trigger disclosure...
    }

    return NextResponse.json({ processed: overdueSecrets.length });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function authorize(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return false;

  const token = header.slice(7).trim();
  return !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
}
```

---

## Testing User Isolation

### Test Pattern: Cross-User Access Prevention

```typescript
describe('User Data Isolation', () => {
  it('prevents User A from accessing User B secrets', async () => {
    // Create User A and User B with secrets
    const userA = await createTestUser();
    const userB = await createTestUser();

    const secretA = await createTestSecret(userA.id);
    const secretB = await createTestSecret(userB.id);

    // User A tries to access User B's secret
    const result = await secretsService.getById(secretB.id, userA.id);

    // Should return undefined (access denied)
    expect(result).toBeUndefined();
  });

  it('prevents User A from updating User B secrets', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const secretB = await createTestSecret(userB.id);

    // User A tries to update User B's secret
    const result = await secretsService.update(
      secretB.id,
      userA.id,
      { title: 'Hacked' }
    );

    // Should return undefined (access denied)
    expect(result).toBeUndefined();

    // Verify original data unchanged
    const original = await secretsService.getById(secretB.id, userB.id);
    expect(original?.title).not.toBe('Hacked');
  });
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Missing userId in WHERE Clause

```typescript
// WRONG
const secret = await db
  .select()
  .from(secrets)
  .where(eq(secrets.id, id)); // Missing userId!
```

### ❌ Pitfall 2: userId in SELECT Instead of WHERE

```typescript
// WRONG - Selects userId but doesn't filter!
const secret = await db
  .select({ id: secrets.id, userId: secrets.userId })
  .from(secrets)
  .where(eq(secrets.id, id)); // Still returns any user's data!
```

### ❌ Pitfall 3: Filtering After Query

```typescript
// WRONG - Fetches all data then filters in memory!
const allSecrets = await db.select().from(secrets);
const userSecrets = allSecrets.filter(s => s.userId === userId); // Too late!
```

### ❌ Pitfall 4: Trusting Client Input

```typescript
// WRONG - Client could send wrong userId!
const { userId } = await request.json();
const secret = await db
  .select()
  .from(secrets)
  .where(eq(secrets.userId, userId)); // Attacker controls userId!

// CORRECT - Use session userId
const session = await getServerSession();
const secret = await db
  .select()
  .from(secrets)
  .where(eq(secrets.userId, session.user.id)); // Server-verified userId
```

---

## Security Checklist

Before deploying any query:

- [ ] Does this query access user-owned data?
- [ ] Is userId included in the WHERE clause?
- [ ] For updates/deletes, do we verify 0 rows = access denied?
- [ ] For ownership validation, do we join with the parent table?
- [ ] For system queries, is proper authentication in place?
- [ ] Have we tested cross-user access prevention?
- [ ] Are we using session.user.id, not client input?

---

## Audit Tools

### Automated Security Audit

Run the security audit script:

```bash
npx tsx scripts/audit-database-queries.ts
```

This will:
- Scan all API routes and service files
- Identify queries missing userId filters
- Report critical security issues
- Generate detailed audit report

### Manual Testing

Test user isolation:

```bash
npm test -- database-query-audit
```

---

## Migration from RLS

### Before (Supabase RLS):

```sql
-- RLS policy automatically filtered by auth.uid()
CREATE POLICY "Users can only access their own secrets"
ON secrets FOR ALL
USING (auth.uid() = user_id);
```

### After (Application-Level):

```typescript
// Must explicitly filter every query
const secret = await db
  .select()
  .from(secrets)
  .where(
    and(
      eq(secrets.id, id),
      eq(secrets.userId, session.user.id) // Required!
    )
  );
```

---

## References

- [Authorization Module](/src/lib/auth/authorization.ts)
- [Secrets Service](/src/lib/db/drizzle.ts)
- [Security Tests](/__tests__/security/database-query-audit.test.ts)
- [Audit Script](/scripts/audit-database-queries.ts)

---

**Last Updated**: 2025-01-06
**Author**: Security Audit Implementation (Task #28)
