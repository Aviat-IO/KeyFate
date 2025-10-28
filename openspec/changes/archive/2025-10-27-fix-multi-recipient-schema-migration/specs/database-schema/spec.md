# Database Schema - Multi-Recipient Support

## MODIFIED Requirements

### Requirement: Database schema SHALL support multiple recipients per secret

The database schema SHALL properly support one-to-many relationship between secrets and recipients, with proper normalization, foreign keys, and indexes for optimal query performance.

#### Scenario: Querying secret with all recipients efficiently

**GIVEN** a secret has 5 recipients  
**WHEN** the application fetches the secret for display  
**THEN** the query SHALL:
- Use a single LEFT JOIN to fetch all recipients (no N+1 queries)
- Return results in under 10ms for typical dataset sizes
- Include proper type safety with `SecretWithRecipients` interface
- Use `json_agg` with FILTER to aggregate recipients array

#### Scenario: Ensuring data integrity with foreign keys

**GIVEN** a secret is deleted by a user  
**WHEN** the deletion is processed  
**THEN** the database SHALL:
- Automatically delete all associated recipients (CASCADE)
- Prevent orphaned recipient records
- Maintain referential integrity through FK constraints

#### Scenario: Supporting primary recipient designation

**GIVEN** a secret has multiple recipients  
**WHEN** querying for the primary recipient  
**THEN** the system SHALL:
- Enforce exactly one primary recipient per secret via UNIQUE constraint
- Default to first recipient if no primary is set
- Use partial index for efficient primary recipient lookups

### Requirement: All database queries SHALL use proper TypeScript types without 'any'

Type safety SHALL be enforced throughout the codebase by using Drizzle ORM's type inference and avoiding the `any` keyword.

#### Scenario: Inferring types from schema

**GIVEN** the database schema is defined in `src/lib/db/schema.ts`  
**WHEN** creating type definitions  
**THEN** the code SHALL:
- Use `typeof secrets.$inferSelect` for Secret type
- Use `typeof secretRecipients.$inferSelect` for SecretRecipient type
- Export explicit interfaces that extend inferred types
- Never use `any` or `as any` type assertions

#### Scenario: Type-safe NextAuth session handling

**GIVEN** NextAuth requires configuration object  
**WHEN** calling `getServerSession()`  
**THEN** the code SHALL:
- Import `GetServerSessionOptions` from next-auth
- Cast authConfig using proper type instead of `any`
- Return typed `Session | null` without assertions

### Requirement: Critical database indexes SHALL be present for query performance

The database SHALL have proper indexes on all foreign keys and commonly queried columns to ensure sub-10ms query performance.

#### Scenario: Dashboard loading user's secrets

**GIVEN** a user has 100 secrets  
**WHEN** loading the dashboard  
**THEN** the database SHALL:
- Use `idx_secrets_user_id` index for user lookup
- Complete query in under 10ms
- Avoid full table scans

#### Scenario: Processing pending reminder jobs

**GIVEN** 1000 pending reminders exist  
**WHEN** the cron job processes reminders  
**THEN** the database SHALL:
- Use `idx_reminder_jobs_scheduled` partial index
- Filter by status and scheduled_for efficiently
- Complete query in under 50ms

#### Scenario: Fetching secret recipients for email sending

**GIVEN** a secret needs disclosure emails sent  
**WHEN** fetching all recipients  
**THEN** the database SHALL:
- Use `idx_secret_recipients_secret_id` index
- Return all recipients in single query
- Complete in under 5ms

### Requirement: Data integrity constraints SHALL prevent invalid data

CHECK constraints SHALL enforce business rules at the database level to prevent invalid data from being stored.

#### Scenario: Recipient must have contact information

**GIVEN** a new recipient is being inserted  
**WHEN** both email and phone are NULL  
**THEN** the database SHALL:
- Reject the insert with constraint violation error
- Enforce CHECK (email IS NOT NULL OR phone IS NOT NULL)

#### Scenario: Secret check-in intervals must be positive

**GIVEN** a secret is being created  
**WHEN** check_in_days is set to 0 or negative  
**THEN** the database SHALL:
- Reject the insert with constraint violation
- Enforce CHECK (check_in_days > 0)

#### Scenario: SSS threshold cannot exceed total shares

**GIVEN** a secret uses Shamir Secret Sharing  
**WHEN** sss_threshold > sss_shares_total  
**THEN** the database SHALL:
- Reject the configuration as mathematically invalid
- Enforce CHECK (sss_threshold <= sss_shares_total)

### Requirement: Email audit trail SHALL track which recipient received each email

The `email_notifications` table SHALL reference the specific recipient who received the email for proper audit trails.

#### Scenario: Logging email sent to specific recipient

**GIVEN** a reminder email is sent to recipient #3 of a secret  
**WHEN** logging the email notification  
**THEN** the system SHALL:
- Store both `recipientId` (FK) and `recipientEmail` (string)
- Allow queries like "all emails sent to this recipient"
- Preserve logs even if recipient is later deleted (SET NULL)

#### Scenario: Querying email delivery history for a recipient

**GIVEN** a recipient has received 10 emails over time  
**WHEN** viewing their email history  
**THEN** the system SHALL:
- Use `idx_email_notifications_recipient_id` index
- Return all emails sent to that recipient efficiently
- Include email metadata (subject, sent_at, error status)
