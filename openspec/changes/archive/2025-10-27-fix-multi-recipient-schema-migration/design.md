# Technical Design: Fix Multi-Recipient Schema Migration

**Change ID:** `fix-multi-recipient-schema-migration`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (UI Components, Pages, API Routes)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Uses typed interfaces
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Type System Layer                            │
│  SecretWithRecipients, PrimaryRecipient, etc.               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Calls typed functions
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Database Query Layer                            │
│  getSecretWithRecipients(), getPrimaryRecipient()           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Drizzle ORM with type inference
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Database Schema                             │
│  secrets + secret_recipients (LEFT JOIN)                    │
└─────────────────────────────────────────────────────────────┘
```

## Type System Design

### Core Types (src/lib/types/secret-types.ts)

```typescript
import { type InferSelectModel } from 'drizzle-orm';
import { secrets, secretRecipients } from '@/lib/db/schema';

/**
 * Secret record without recipients
 * Use this when you don't need recipient data
 */
export type Secret = InferSelectModel<typeof secrets>;

/**
 * Insert type for creating new secrets
 */
export type SecretInsert = InferInsertModel<typeof secrets>;

/**
 * Single recipient record
 */
export type SecretRecipient = InferSelectModel<typeof secretRecipients>;

/**
 * Insert type for creating new recipients
 */
export type SecretRecipientInsert = InferInsertModel<typeof secretRecipients>;

/**
 * Secret with all its recipients loaded
 * This is the primary type used throughout the application
 */
export interface SecretWithRecipients extends Secret {
  recipients: SecretRecipient[];
}

/**
 * Helper to extract just the primary recipient
 * Useful for backward compatibility and display
 */
export interface PrimaryRecipientData {
  name: string;
  email: string | null;
  phone: string | null;
  contactMethod: 'email' | 'phone' | 'both';
}

/**
 * Input type for creating/updating recipients
 */
export interface RecipientInput {
  name: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}
```

### Type Guards

```typescript
/**
 * Check if a secret has recipients loaded
 */
export function isSecretWithRecipients(
  secret: Secret | SecretWithRecipients
): secret is SecretWithRecipients {
  return 'recipients' in secret && Array.isArray(secret.recipients);
}

/**
 * Check if recipient has email
 */
export function hasEmail(recipient: SecretRecipient): boolean {
  return recipient.email !== null && recipient.email !== '';
}

/**
 * Check if recipient has phone
 */
export function hasPhone(recipient: SecretRecipient): boolean {
  return recipient.phone !== null && recipient.phone !== '';
}
```

## Database Query Layer Design

### File: src/lib/db/queries/secrets.ts

```typescript
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { secrets, secretRecipients } from '@/lib/db/schema';
import type { 
  Secret, 
  SecretWithRecipients, 
  SecretRecipient,
  SecretRecipientInsert 
} from '@/lib/types/secret-types';

/**
 * Fetch a secret with all its recipients
 * Returns null if secret not found or user doesn't own it
 */
export async function getSecretWithRecipients(
  secretId: string,
  userId: string
): Promise<SecretWithRecipients | null> {
  const results = await db
    .select({
      // Spread all secret fields
      id: secrets.id,
      userId: secrets.userId,
      title: secrets.title,
      checkInDays: secrets.checkInDays,
      status: secrets.status,
      serverShare: secrets.serverShare,
      iv: secrets.iv,
      authTag: secrets.authTag,
      sssSharesTotal: secrets.sssSharesTotal,
      sssThreshold: secrets.sssThreshold,
      isTriggered: secrets.isTriggered,
      lastCheckIn: secrets.lastCheckIn,
      nextCheckIn: secrets.nextCheckIn,
      triggeredAt: secrets.triggeredAt,
      createdAt: secrets.createdAt,
      updatedAt: secrets.updatedAt,
      // Aggregate recipients as JSON array
      recipients: sql<SecretRecipient[]>`
        COALESCE(
          json_agg(
            json_build_object(
              'id', ${secretRecipients.id},
              'secretId', ${secretRecipients.secretId},
              'name', ${secretRecipients.name},
              'email', ${secretRecipients.email},
              'phone', ${secretRecipients.phone},
              'isPrimary', ${secretRecipients.isPrimary},
              'createdAt', ${secretRecipients.createdAt},
              'updatedAt', ${secretRecipients.updatedAt}
            )
          ) FILTER (WHERE ${secretRecipients.id} IS NOT NULL),
          '[]'::json
        )
      `.as('recipients'),
    })
    .from(secrets)
    .leftJoin(secretRecipients, eq(secretRecipients.secretId, secrets.id))
    .where(and(
      eq(secrets.id, secretId),
      eq(secrets.userId, userId)
    ))
    .groupBy(secrets.id)
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  return results[0] as SecretWithRecipients;
}

/**
 * Get all secrets for a user with their recipients
 * Used for dashboard and listings
 */
export async function getUserSecretsWithRecipients(
  userId: string
): Promise<SecretWithRecipients[]> {
  const results = await db
    .select({
      id: secrets.id,
      userId: secrets.userId,
      title: secrets.title,
      checkInDays: secrets.checkInDays,
      status: secrets.status,
      serverShare: secrets.serverShare,
      iv: secrets.iv,
      authTag: secrets.authTag,
      sssSharesTotal: secrets.sssSharesTotal,
      sssThreshold: secrets.sssThreshold,
      isTriggered: secrets.isTriggered,
      lastCheckIn: secrets.lastCheckIn,
      nextCheckIn: secrets.nextCheckIn,
      triggeredAt: secrets.triggeredAt,
      createdAt: secrets.createdAt,
      updatedAt: secrets.updatedAt,
      recipients: sql<SecretRecipient[]>`
        COALESCE(
          json_agg(
            json_build_object(
              'id', ${secretRecipients.id},
              'secretId', ${secretRecipients.secretId},
              'name', ${secretRecipients.name},
              'email', ${secretRecipients.email},
              'phone', ${secretRecipients.phone},
              'isPrimary', ${secretRecipients.isPrimary},
              'createdAt', ${secretRecipients.createdAt},
              'updatedAt', ${secretRecipients.updatedAt}
            )
          ) FILTER (WHERE ${secretRecipients.id} IS NOT NULL),
          '[]'::json
        )
      `.as('recipients'),
    })
    .from(secrets)
    .leftJoin(secretRecipients, eq(secretRecipients.secretId, secrets.id))
    .where(eq(secrets.userId, userId))
    .groupBy(secrets.id)
    .orderBy(secrets.createdAt);

  return results as SecretWithRecipients[];
}

/**
 * Get the primary recipient for a secret
 * Falls back to first recipient if no primary is set
 */
export async function getPrimaryRecipient(
  secretId: string
): Promise<SecretRecipient | null> {
  // Try to get the primary recipient
  const primary = await db
    .select()
    .from(secretRecipients)
    .where(and(
      eq(secretRecipients.secretId, secretId),
      eq(secretRecipients.isPrimary, true)
    ))
    .limit(1);

  if (primary.length > 0) {
    return primary[0];
  }

  // Fallback: get any recipient (first one)
  const any = await db
    .select()
    .from(secretRecipients)
    .where(eq(secretRecipients.secretId, secretId))
    .limit(1);

  return any.length > 0 ? any[0] : null;
}

/**
 * Get all recipients for a secret
 */
export async function getSecretRecipients(
  secretId: string
): Promise<SecretRecipient[]> {
  return await db
    .select()
    .from(secretRecipients)
    .where(eq(secretRecipients.secretId, secretId))
    .orderBy(secretRecipients.isPrimary); // Primary first
}

/**
 * Update recipients for a secret
 * Deletes old recipients and creates new ones in a transaction
 */
export async function updateSecretRecipients(
  secretId: string,
  newRecipients: SecretRecipientInsert[]
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing recipients
    await tx
      .delete(secretRecipients)
      .where(eq(secretRecipients.secretId, secretId));

    // Insert new recipients
    if (newRecipients.length > 0) {
      await tx.insert(secretRecipients).values(
        newRecipients.map(r => ({
          ...r,
          secretId,
        }))
      );
    }
  });
}
```

## Component Update Patterns

### Pattern 1: Secret Card Component

**Before (broken):**
```typescript
// ❌ References non-existent fields
<div>{secret.recipientName}</div>
<div>{secret.recipientEmail}</div>
```

**After (fixed):**
```typescript
// ✅ Uses primary recipient from array
import { getPrimaryRecipientDisplay } from '@/lib/utils/recipients';

function SecretCard({ secret }: { secret: SecretWithRecipients }) {
  const primary = secret.recipients.find(r => r.isPrimary) || secret.recipients[0];
  const recipientCount = secret.recipients.length;
  
  return (
    <>
      <div>{primary?.name || 'No recipient'}</div>
      <div>{primary?.email || primary?.phone || 'No contact'}</div>
      {recipientCount > 1 && (
        <Badge>+{recipientCount - 1} more</Badge>
      )}
    </>
  );
}
```

### Pattern 2: Cron Job Processing

**Before (broken):**
```typescript
// ❌ Tries to access single recipient
await sendReminderEmail({
  to: secret.recipientEmail,
  name: secret.recipientName,
  secretTitle: secret.title,
});
```

**After (fixed):**
```typescript
// ✅ Iterates over all recipients
const secretWithRecipients = await getSecretWithRecipients(secret.id, secret.userId);

if (!secretWithRecipients) {
  console.error(`Secret ${secret.id} not found`);
  return;
}

for (const recipient of secretWithRecipients.recipients) {
  if (recipient.email) {
    try {
      await sendReminderEmail({
        to: recipient.email,
        name: recipient.name,
        secretTitle: secretWithRecipients.title,
        recipientId: recipient.id,
      });
    } catch (error) {
      console.error(`Failed to send to ${recipient.email}:`, error);
      // Continue with other recipients
    }
  }
}
```

### Pattern 3: API Route Updates

**Before (broken):**
```typescript
// ❌ Accepts old schema
const body = {
  title: string;
  recipient_name: string;
  recipient_email: string;
  contact_method: string;
};
```

**After (fixed):**
```typescript
// ✅ Accepts recipients array
const bodySchema = z.object({
  title: z.string(),
  recipients: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    isPrimary: z.boolean(),
  })).min(1, 'At least one recipient required'),
});

// Validate at least one recipient has contact info
const validated = bodySchema.parse(body);
const hasContact = validated.recipients.every(r => r.email || r.phone);
if (!hasContact) {
  throw new Error('Each recipient must have email or phone');
}
```

## Email Service Updates

### Interface Changes

**Before:**
```typescript
interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
}
```

**After:**
```typescript
import type { SecretRecipient } from '@/lib/types/secret-types';

interface SendEmailParams {
  recipient: SecretRecipient;
  subject: string;
  body: string;
  secretId: string;
}

// Helper to get email address from recipient
function getRecipientEmail(recipient: SecretRecipient): string | null {
  return recipient.email || null;
}

// Send email to a recipient
async function sendToRecipient(params: SendEmailParams): Promise<void> {
  const email = getRecipientEmail(params.recipient);
  if (!email) {
    throw new Error(`Recipient ${params.recipient.id} has no email`);
  }

  await sendEmail({
    to: email,
    subject: params.subject,
    body: params.body,
  });

  // Log with recipient ID for tracking
  await logEmailSent({
    recipientId: params.recipient.id,
    secretId: params.secretId,
    email,
    subject: params.subject,
  });
}
```

## Migration Checklist

### Pre-Implementation Verification
- [ ] Confirm migrations 0004 & 0005 are applied
- [ ] Verify no secrets exist with old schema fields
- [ ] Check that `secret_recipients` table exists and has data

### Implementation Order
1. Create type definitions (no dependencies)
2. Create database query functions (depends on types)
3. Update components (depends on queries)
4. Update API routes (depends on queries)
5. Update cron jobs (depends on queries)
6. Update email service (depends on queries)
7. Run tests and validate

### Testing Strategy
- Unit test each query function with mocked DB
- Integration test full flow: create → read → update → delete
- E2E test user journey: create secret → view → receive reminder
- Load test: ensure N+1 queries avoided with JOIN approach

## Performance Considerations

### Query Performance
- **JOIN vs N+1:** Using LEFT JOIN eliminates N+1 query problem
- **Indexing:** Ensure `secret_recipients.secret_id` is indexed (FK auto-indexes)
- **Result Size:** JSON aggregation keeps result set small

### Caching Strategy
- Consider caching `SecretWithRecipients` for frequently accessed secrets
- Invalidate cache on recipient updates
- Use Redis or Next.js cache for production

## Backward Compatibility

**None required** - This is fixing an incomplete migration, not adding new functionality.

All new secrets created after migration 0004 already use the new schema.  
Any code still referencing old fields is broken and needs to be fixed.

## Security Considerations

1. **Authorization:** Always verify `userId` matches `secret.userId` before returning recipients
2. **PII Protection:** Recipient email/phone are sensitive - audit logging access
3. **Input Validation:** Validate recipient data on create/update (Zod schemas)
4. **SQL Injection:** Using Drizzle ORM prevents SQL injection

## Error Handling

```typescript
// Example error handling pattern
export async function getSecretWithRecipientsOrThrow(
  secretId: string,
  userId: string
): Promise<SecretWithRecipients> {
  const secret = await getSecretWithRecipients(secretId, userId);
  
  if (!secret) {
    throw new Error(`Secret ${secretId} not found or unauthorized`);
  }
  
  if (secret.recipients.length === 0) {
    console.warn(`Secret ${secretId} has no recipients`);
  }
  
  return secret;
}
```

## Rollback Plan

If issues arise post-deployment:

1. **Immediate:** Revert code deploy (keeps DB schema intact)
2. **Investigation:** Check logs for specific errors
3. **Hotfix:** Fix specific issue and redeploy
4. **Last Resort:** No DB rollback needed since schema is already correct

The database schema is already correct - this change is pure code cleanup.
