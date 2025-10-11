# Database Schema - Multi-Recipient Equal Treatment

## REMOVED Requirements

### Requirement: Secret recipients SHALL have primary designation
**Reason:** Primary recipient concept creates artificial hierarchy and complicates validation logic  
**Migration:** Drop `is_primary` column from `secret_recipients` table. No data migration needed as all recipients will be treated equally.

## MODIFIED Requirements

### Requirement: Secret recipients table SHALL store contact information for multiple recipients per secret

The `secret_recipients` table SHALL store recipient details without hierarchical designation. All recipients SHALL be treated equally.

#### Scenario: Storing recipients for a multi-recipient secret

**GIVEN** a user creates a secret with 3 recipients  
**WHEN** the secret is saved to the database  
**THEN** the system SHALL:
- Insert 3 rows into `secret_recipients` table
- Store name, email, phone for each recipient
- Set `created_at` timestamp for ordering
- NOT set any `isPrimary` flag
- Associate all recipients with the same `secret_id`

#### Scenario: Querying recipients for display

**GIVEN** a secret has multiple recipients  
**WHEN** fetching recipients for display  
**THEN** the system SHALL:
- Order recipients by `created_at ASC` (chronological order)
- Return all recipients with equal status
- NOT filter or prioritize any recipient
- Include all contact information

#### Scenario: Updating recipients for an existing secret

**GIVEN** a user edits a secret's recipients  
**WHEN** the update is saved  
**THEN** the system SHALL:
- Delete existing recipient records (cascade delete)
- Insert new recipient records
- Set `created_at` to current timestamp for new recipients
- Maintain chronological ordering based on new insert order

## ADDED Requirements

### Requirement: Database indexes SHALL support efficient recipient queries without primary filtering

Indexes SHALL be optimized for querying all recipients equally without special treatment for any single recipient.

#### Scenario: Efficient lookup of all recipients for a secret

**GIVEN** the database has 10,000 secrets with average 3 recipients each  
**WHEN** querying recipients for a specific secret  
**THEN** the system SHALL:
- Use index on `(secret_id, created_at)`
- Return results in <5ms
- Order chronologically without additional sorting

#### Scenario: Removing deprecated primary recipient index

**GIVEN** the database has a partial index on `is_primary`  
**WHEN** the migration runs  
**THEN** the system SHALL:
- Drop `idx_secret_recipients_primary` index
- Remove all indexes referencing `is_primary` column
- Create standard index on `(secret_id, created_at)` if not exists
