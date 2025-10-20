## ADDED Requirements

### Requirement: Comprehensive Event Logging

The system SHALL log all significant user and system activities to an audit log table for Pro tier users.

#### Scenario: Secret lifecycle events logged
- **WHEN** a Pro user creates, edits, or deletes a secret
- **THEN** an audit log entry is created with event_type (secret_created/secret_edited/secret_deleted), resource_id (secret ID), and details (what changed)

#### Scenario: Check-in events logged
- **WHEN** a Pro user performs a check-in
- **THEN** an audit log entry records the check-in with secret_id, timestamp, and next_check_in date

#### Scenario: Recipient management logged
- **WHEN** a Pro user adds or removes a recipient
- **THEN** an audit log entry records the change with recipient details (name, email)

#### Scenario: Secret trigger logged
- **WHEN** a secret is triggered (disclosed to recipients)
- **THEN** an audit log entry records the trigger event, secret_id, and recipient list

#### Scenario: Authentication events logged
- **WHEN** any user logs in or logs out
- **THEN** an audit log entry records the authentication event (if user is Pro tier)

#### Scenario: Subscription changes logged
- **WHEN** a user upgrades, downgrades, or cancels their subscription
- **THEN** an audit log entry records the subscription change with old and new tier

### Requirement: Audit Log Data Structure

The system SHALL capture comprehensive context for each audit log entry.

#### Scenario: Required audit fields
- **WHEN** any event is logged
- **THEN** the audit entry includes: id (UUID), user_id, event_type, event_category, resource_type, resource_id, timestamp (created_at)

#### Scenario: Optional audit fields
- **WHEN** any event is logged
- **THEN** the audit entry MAY include: details (JSONB), ip_address, user_agent

#### Scenario: Event categories
- **WHEN** categorizing events
- **THEN** events are grouped into: secrets, authentication, subscriptions, settings, recipients

### Requirement: Pro-Only Audit Access

The system SHALL restrict audit log viewing and export to Pro tier users only.

#### Scenario: Pro user views audit logs
- **WHEN** a Pro user navigates to the audit logs page
- **THEN** they see a paginated table of their audit log entries with filters

#### Scenario: Free user attempts to view audit logs
- **WHEN** a Free user navigates to the audit logs page
- **THEN** they see an upgrade prompt: "Audit logs are a Pro feature"

#### Scenario: Server-side audit access validation
- **WHEN** any audit log API request is made
- **THEN** the server validates the user's tier is Pro before returning data

### Requirement: Audit Log Persistence

The system SHALL store audit logs indefinitely with no automatic deletion.

#### Scenario: Audit log retention
- **WHEN** audit logs are created
- **THEN** they are stored permanently in the audit_logs table with no TTL or deletion

#### Scenario: Tier downgrade audit preservation
- **WHEN** a Pro user downgrades to Free
- **THEN** existing audit logs remain in the database (no deletion)
- **AND** no new audit logs are created or accessible until they upgrade again

### Requirement: Audit Log Query and Export

The system SHALL provide filtering, pagination, and export capabilities for audit logs.

#### Scenario: Filter by event type
- **WHEN** a Pro user filters audit logs by event type
- **THEN** only logs matching the selected event type(s) are displayed

#### Scenario: Filter by date range
- **WHEN** a Pro user filters audit logs by date range
- **THEN** only logs within the specified date range are displayed

#### Scenario: Pagination
- **WHEN** a Pro user views audit logs
- **THEN** logs are paginated (e.g., 50 per page) with navigation controls

#### Scenario: Export audit logs
- **WHEN** a Pro user clicks "Export Audit Logs"
- **THEN** the system generates a downloadable file (CSV or JSON) containing filtered audit logs

#### Scenario: Search audit logs
- **WHEN** a Pro user searches audit logs
- **THEN** logs matching the search term in event details are displayed

### Requirement: Audit Logging Reliability

The system SHALL ensure audit logging failures do not block user operations.

#### Scenario: Logging failure handling
- **WHEN** an audit log write fails (e.g., database error)
- **THEN** the failure is logged to error tracking
- **AND** the user's operation completes successfully without interruption

#### Scenario: Asynchronous logging
- **WHEN** an event occurs that should be logged
- **THEN** the audit log write happens asynchronously to avoid blocking the operation
