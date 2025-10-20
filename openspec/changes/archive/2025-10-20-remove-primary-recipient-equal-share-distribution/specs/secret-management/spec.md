# Secret Management - Equal Recipient Treatment

## REMOVED Requirements

### Requirement: Secret creation SHALL designate one recipient as primary
**Reason:** All recipients should be treated equally without hierarchical designation  
**Migration:** Remove `isPrimary` field from forms, validation, and API responses

### Requirement: Secret editing SHALL enforce exactly one primary recipient
**Reason:** Primary recipient concept removed entirely  
**Migration:** Remove primary recipient toggle checkbox and validation logic

### Requirement: Secret display SHALL highlight primary recipient
**Reason:** UI should show all recipients equally  
**Migration:** Remove "Primary" badges and preferential display ordering

## MODIFIED Requirements

### Requirement: Secret creation form SHALL support multiple recipients with tier validation

Users SHALL be able to add multiple recipients up to their tier limit. All recipients SHALL be treated equally without designation.

#### Scenario: Free user creating secret with single recipient

**GIVEN** a free tier user creates a new secret  
**WHEN** the form loads  
**THEN** the system SHALL:
- Display 1 recipient field by default
- NOT show any "Primary" checkbox or indicator
- Show "Add More (Pro)" button (disabled/upgrade prompt)
- Allow submission with 1 recipient

#### Scenario: Pro user adding multiple recipients

**GIVEN** a pro tier user creates a new secret  
**WHEN** adding recipients  
**THEN** the system SHALL:
- Allow adding up to 5 recipients total
- Display all recipients equally (no primary designation)
- Order recipients by creation order in UI
- Show counter: "3 of 5 recipients"
- NOT require selecting a primary recipient

#### Scenario: Removing a recipient when multiple exist

**GIVEN** a secret form has 3 recipients  
**WHEN** user removes one recipient  
**THEN** the system SHALL:
- Remove the recipient from the list
- NOT require re-designating a primary
- Allow submission with remaining recipients
- Maintain chronological order of remaining recipients

### Requirement: Secret display SHALL show all recipients equally

Secret view pages SHALL display all recipients in chronological order without highlighting any as primary.

#### Scenario: Viewing secret with multiple recipients

**GIVEN** a secret has 3 recipients: Alice (created first), Bob, Carol  
**WHEN** viewing the secret details page  
**THEN** the UI SHALL:
- Display all 3 recipients in order: Alice, Bob, Carol
- NOT show any "Primary" badge or indicator
- Show all contact information equally
- Use same styling for all recipients

#### Scenario: Dashboard showing secret with multiple recipients

**GIVEN** a user views their dashboard  
**WHEN** displaying a secret card with 3 recipients  
**THEN** the card SHALL:
- Show first recipient's name (chronologically first)
- Display badge "+2 more recipients" if applicable
- NOT show "Primary Recipient" label
- Load all recipients efficiently (no N+1 queries)

### Requirement: SSS configuration SHALL guide users for multi-recipient scenarios

When users add multiple recipients, the system SHALL provide clear guidance on threshold configuration and share distribution.

#### Scenario: Auto-expanding SSS configuration for multiple recipients

**GIVEN** a user creates a secret  
**WHEN** they add a 2nd recipient  
**THEN** the system SHALL:
- Automatically expand the "Secret Sharing Configuration" accordion
- Show info alert: "All recipients will receive the same share"
- Display example configurations
- Maintain validation: `threshold <= total_shares`

#### Scenario: Displaying SSS configuration examples

**GIVEN** a user views the SSS configuration accordion  
**WHEN** they have 3 recipients  
**THEN** the system SHALL show examples:
- "3 shares, threshold 2: Server + any 1 recipient can reconstruct"
- "3 shares, threshold 3: All shares required (maximum security)"
- "4 shares, threshold 2: Server + any 1 recipient, with 1 backup share"
- Clear explanation of implications

#### Scenario: Validating SSS total shares maximum

**GIVEN** a user configures SSS settings  
**WHEN** they set total shares value  
**THEN** the system SHALL:
- Enforce maximum of 5 total shares
- Show error if value exceeds 5
- Validate `total_shares >= 2` (minimum requirement)
- Provide helper text explaining the limit

## ADDED Requirements

### Requirement: Share distribution SHALL send identical share to all recipients

When a secret triggers, all recipients SHALL receive the same cryptographic share (share #1 by default).

#### Scenario: Triggered secret sending shares to 3 recipients

**GIVEN** a secret with 3 recipients triggers  
**WHEN** the cron job processes the disclosure  
**THEN** the system SHALL:
- Retrieve `recipient_share_index` from secret (defaults to 1)
- Send share #1 to all 3 recipients via email
- Include identical share content in each email
- Log each email send with `recipientId` reference
- Continue sending to remaining recipients if one email fails

#### Scenario: Share instructions displaying equal distribution

**GIVEN** a user completes secret creation with 2 recipients  
**WHEN** viewing the share instructions page  
**THEN** the system SHALL:
- Show info alert: "KeyFate will send Share 1 to all recipients"
- Display share #1 with label "For all recipients"
- Show remaining shares as "Backup shares"
- Explain that recipients receive identical shares

#### Scenario: Preventing premature secret reconstruction through recipient collusion

**GIVEN** a secret has 3 recipients who all receive share #1  
**WHEN** recipients attempt to collaborate before trigger  
**THEN** the security model SHALL:
- Prevent reconstruction (all have same share)
- Require server share #0 + (threshold - 1) additional shares
- Only release server share after trigger event
- Make collusion attack impossible without server cooperation

### Requirement: Recipient management SHALL support equal CRUD operations for all recipients

Users SHALL have full create, read, update, delete operations on recipients without special handling for any single recipient.

#### Scenario: Editing recipients without primary designation

**GIVEN** a user edits a secret with 3 recipients  
**WHEN** viewing the edit form  
**THEN** the system SHALL:
- Display all recipients equally
- Allow removing any recipient (if not the last one)
- Allow adding new recipients (up to tier limit)
- NOT show primary designation checkboxes
- Save all recipients with equal status

#### Scenario: Attempting to remove the last recipient

**GIVEN** a secret has only 1 recipient  
**WHEN** user tries to remove it  
**THEN** the system SHALL:
- Prevent deletion
- Show error: "Secret must have at least one recipient"
- Suggest deleting entire secret instead
- NOT allow saving without at least 1 recipient

#### Scenario: Reordering recipients by creation time

**GIVEN** a secret has recipients added at different times  
**WHEN** displaying the recipient list  
**THEN** the system SHALL:
- Order by `createdAt ASC` (chronological)
- First added recipient appears first
- Maintain consistent ordering across all views
- NOT allow manual reordering (use creation order)
