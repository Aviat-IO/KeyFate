## ADDED Requirements

### Requirement: Admin Authentication

The system SHALL restrict admin dashboard access to users with the `isAdmin`
flag set to true.

#### Scenario: Admin user accesses dashboard

- **GIVEN** a user with `isAdmin = true` is authenticated
- **WHEN** the user navigates to `/admin`
- **THEN** the system SHALL render the admin dashboard
- **AND** SHALL load all metrics data via server-side load function

#### Scenario: Non-admin user accesses dashboard

- **GIVEN** a user with `isAdmin = false` is authenticated
- **WHEN** the user navigates to `/admin`
- **THEN** the system SHALL return a 403 Forbidden error
- **AND** SHALL NOT expose any admin metrics or data

#### Scenario: Unauthenticated user accesses dashboard

- **GIVEN** no authenticated session exists
- **WHEN** a request is made to `/admin`
- **THEN** the system SHALL redirect to the sign-in page

### Requirement: System Overview Metrics

The system SHALL provide aggregated metrics about secrets, users, and email
delivery on the admin dashboard.

#### Scenario: Secret status summary

- **GIVEN** an admin views the dashboard
- **WHEN** the overview section loads
- **THEN** the system SHALL display counts of secrets by status (active, paused,
  triggered, failed)
- **AND** SHALL display the total number of secrets across all users

#### Scenario: User summary

- **GIVEN** an admin views the dashboard
- **WHEN** the overview section loads
- **THEN** the system SHALL display total user count, count of users with active
  secrets, and count of pro-tier users

#### Scenario: Email delivery summary

- **GIVEN** an admin views the dashboard
- **WHEN** the overview section loads
- **THEN** the system SHALL display counts of disclosure emails by status (sent,
  failed, pending)
- **AND** SHALL display counts for the last 24 hours and all time

### Requirement: Failed Secrets List

The system SHALL display a list of secrets in failed status with actionable
context for admin investigation.

#### Scenario: Failed secrets table

- **GIVEN** an admin views the problems section
- **WHEN** failed secrets are loaded
- **THEN** the system SHALL display: secret title, owner email, last error
  message, failure timestamp, retry count
- **AND** SHALL order by most recent failure first
- **AND** SHALL paginate results (20 per page)

#### Scenario: No failed secrets

- **GIVEN** an admin views the problems section
- **WHEN** no secrets have status "failed"
- **THEN** the system SHALL display an empty state message

#### Scenario: Zero-knowledge preservation

- **GIVEN** an admin views failed secrets
- **WHEN** secret details are displayed
- **THEN** the system SHALL NOT display secret content, server share, encryption
  keys, or any reconstructable data
- **AND** SHALL only display metadata (title, status, timestamps, error
  messages)

### Requirement: Email Failure Queue

The system SHALL display the email dead letter queue with retry capabilities on
the admin dashboard.

#### Scenario: Email failures table

- **GIVEN** an admin views the problems section
- **WHEN** email failures are loaded
- **THEN** the system SHALL display: recipient email, error message, email type,
  provider, timestamp, retry count
- **AND** SHALL order by most recent failure first

#### Scenario: Retry failed email

- **GIVEN** an admin views a failed email entry
- **WHEN** the admin clicks the retry button
- **THEN** the system SHALL invoke the existing email retry API endpoint
- **AND** SHALL update the entry status on success

### Requirement: Cron Job Health

The system SHALL display the status of all scheduled cron jobs on the admin
dashboard.

#### Scenario: Cron status display

- **GIVEN** an admin views the system section
- **WHEN** cron health data loads
- **THEN** the system SHALL display each cron job name, last execution time,
  execution result (success/failure), and any error message
- **AND** SHALL highlight jobs that have not run within their expected interval

#### Scenario: Cron health warning

- **GIVEN** a cron job has not executed within 2x its scheduled interval
- **WHEN** the admin views cron health
- **THEN** the system SHALL display a warning indicator for that job
- **AND** SHALL show the time since last successful execution

### Requirement: Admin Navigation

The system SHALL add an admin link to the application navigation for admin users
only.

#### Scenario: Admin nav link visible

- **GIVEN** a user with `isAdmin = true` is authenticated
- **WHEN** the navigation bar renders
- **THEN** the system SHALL display an "Admin" link pointing to `/admin`

#### Scenario: Admin nav link hidden

- **GIVEN** a user with `isAdmin = false` is authenticated
- **WHEN** the navigation bar renders
- **THEN** the system SHALL NOT display any admin-related navigation links
