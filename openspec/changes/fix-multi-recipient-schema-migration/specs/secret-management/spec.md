# Secret Management - Multi-Recipient Support

## MODIFIED Requirements

### Requirement: Secret view pages SHALL display all recipients

Secret detail pages SHALL show complete recipient information with proper type safety and support for multiple recipients per secret.

#### Scenario: Viewing secret with multiple recipients

**GIVEN** a secret has 3 recipients: Alice (primary), Bob, and Carol  
**WHEN** viewing the secret details page  
**THEN** the UI SHALL:
- Display all 3 recipients in a list
- Highlight Alice as "Primary Recipient"
- Show email/phone for each recipient
- Use `SecretWithRecipients` type (not `any`)

#### Scenario: Dashboard showing secret with recipient count

**GIVEN** a user views their dashboard with 10 secrets  
**WHEN** displaying each secret card  
**THEN** the card SHALL:
- Show the primary recipient's name
- Display badge "+2 more" if multiple recipients exist
- Load all recipients in single query (no N+1)
- Use proper TypeScript types throughout

### Requirement: Secret creation/editing SHALL support multiple recipients with tier validation

Users SHALL be able to add multiple recipients up to their tier limit, with proper validation and type-safe code.

#### Scenario: Free user adding second recipient

**GIVEN** a free tier user creates a secret with 1 recipient  
**WHEN** attempting to add a second recipient  
**THEN** the system SHALL:
- Disable "Add Recipient" button in UI
- Show upgrade modal explaining tier limits
- Reject API request with 403 if attempted
- Return error code `RECIPIENT_LIMIT_EXCEEDED`

#### Scenario: Pro user managing 5 recipients

**GIVEN** a pro tier user edits a secret  
**WHEN** managing recipients  
**THEN** the system SHALL:
- Allow adding up to 5 recipients total
- Show "X of 5 recipients" counter
- Support removing and editing existing recipients
- Require at least one recipient before save
- Ensure exactly one recipient is marked primary

#### Scenario: Validating recipient contact information

**GIVEN** a user adds a new recipient  
**WHEN** submitting the form  
**THEN** the system SHALL:
- Require either email OR phone (at least one)
- Use Zod schema for validation
- Type recipient data as `RecipientInput` (not `any`)
- Validate email format if provided

### Requirement: Cron jobs SHALL process reminders for all recipients

Reminder processing SHALL iterate over all recipients and send individual emails with proper error handling.

#### Scenario: Sending reminder to secret with 3 recipients

**GIVEN** a secret with 3 recipients is due for reminder  
**WHEN** the cron job processes the reminder  
**THEN** the system SHALL:
- Fetch secret using `getSecretWithRecipients()`
- Send separate reminder email to each recipient
- Log each email with `recipientId` reference
- Continue processing if one email fails
- Mark job complete only if all emails sent

#### Scenario: Handling partial email delivery failure

**GIVEN** a secret has 5 recipients and email #3 fails  
**WHEN** processing the reminder  
**THEN** the system SHALL:
- Successfully send to recipients 1, 2, 4, 5
- Log error for recipient #3 with details
- NOT fail the entire job
- Allow retry for failed recipient only

### Requirement: API endpoints SHALL use typed recipient arrays

All API endpoints SHALL accept and return properly typed recipient arrays without using `any`.

#### Scenario: Creating secret with recipients via API

**GIVEN** a client posts to `/api/secrets`  
**WHEN** the request includes recipients array  
**THEN** the API SHALL:
- Validate input with Zod schema for `RecipientInput[]`
- Check tier limits before creation
- Insert secret and recipients in transaction
- Return `SecretWithRecipients` type

#### Scenario: Updating secret recipients via API

**GIVEN** a user edits secret recipients  
**WHEN** PUT `/api/secrets/[id]` is called  
**THEN** the API SHALL:
- Accept `recipients: RecipientInput[]` in request body
- Validate ownership of secret
- Delete old recipients and insert new ones atomically
- Enforce tier limits on recipient count
- Validate at least one recipient provided

## ADDED Requirements

### Requirement: Recipient management UI SHALL allow adding, editing, and removing recipients

Users SHALL have full CRUD operations on recipients through an intuitive interface.

#### Scenario: Adding a new recipient to existing secret

**GIVEN** a secret has 2 recipients and user is pro tier  
**WHEN** clicking "Add Recipient" button  
**THEN** the system SHALL:
- Open modal/dialog with recipient form
- Show fields: name (required), email (optional), phone (optional)
- Show "Set as Primary" checkbox
- Validate at least email or phone is provided
- Save new recipient to database

#### Scenario: Setting a different primary recipient

**GIVEN** a secret has 3 recipients with Bob as primary  
**WHEN** user clicks "Set as Primary" on Alice  
**THEN** the system SHALL:
- Unset Bob's isPrimary flag
- Set Alice's isPrimary flag
- Ensure exactly one primary recipient
- Update database atomically

#### Scenario: Removing a non-primary recipient

**GIVEN** a secret has 3 recipients  
**WHEN** user removes a non-primary recipient  
**THEN** the system SHALL:
- Show confirmation dialog
- Delete recipient from database
- Keep other recipients unchanged
- Refresh the recipients list

#### Scenario: Attempting to remove the last recipient

**GIVEN** a secret has only 1 recipient  
**WHEN** user tries to remove it  
**THEN** the system SHALL:
- Prevent deletion
- Show error: "Secret must have at least one recipient"
- Suggest deleting the entire secret instead

### Requirement: Database helper functions SHALL provide typed query interfaces

A dedicated query layer SHALL provide type-safe functions for all secret-recipient operations.

#### Scenario: Using getSecretWithRecipients helper

**GIVEN** application code needs to fetch a secret  
**WHEN** calling `getSecretWithRecipients(secretId, userId)`  
**THEN** the function SHALL:
- Return `Promise<SecretWithRecipients | null>`
- Use LEFT JOIN with json_agg for recipients
- Filter by both secretId and userId (authorization)
- Return null if not found or unauthorized

#### Scenario: Using getPrimaryRecipient helper

**GIVEN** code needs just the primary recipient  
**WHEN** calling `getPrimaryRecipient(secretId)`  
**THEN** the function SHALL:
- Return `Promise<SecretRecipient | null>`
- Query for isPrimary = true first
- Fallback to first recipient if no primary
- Use index for efficient lookup

#### Scenario: Updating recipients atomically

**GIVEN** a secret's recipients need to be updated  
**WHEN** calling `updateSecretRecipients(secretId, newRecipients)`  
**THEN** the function SHALL:
- Use database transaction
- Delete existing recipients
- Insert new recipients
- Commit or rollback atomically
- Return `Promise<void>`
