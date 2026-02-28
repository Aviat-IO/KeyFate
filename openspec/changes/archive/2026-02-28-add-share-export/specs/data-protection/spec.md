## ADDED Requirements

### Requirement: Share Export for Data Sovereignty

The system SHALL provide Pro users with the ability to export their server-stored
share for backup and offline reconstruction purposes.

#### Scenario: Export share for active secret

- **GIVEN** a Pro user has an active secret
- **WHEN** the user requests share export
- **THEN** the system SHALL generate a downloadable export file
- **AND** SHALL include the encrypted server share
- **AND** SHALL include secret metadata (ID, title, share index, threshold)
- **AND** SHALL include creation timestamp and export timestamp
- **AND** SHALL include reconstruction instructions
- **AND** SHALL include offline tool download links
- **AND** SHALL log the export event in audit log

#### Scenario: Export file format

- **GIVEN** a share export is generated
- **WHEN** the file is created
- **THEN** the system SHALL use JSON format with version field
- **AND** SHALL include SHA-256 checksum for integrity verification
- **AND** SHALL NOT include any keys or decryption material
- **AND** SHALL be compatible with offline reconstruction tool

#### Scenario: Export rate limiting

- **GIVEN** a user requests share export
- **WHEN** the request is processed
- **THEN** the system SHALL enforce rate limit of 3 exports per secret per hour
- **AND** SHALL return 429 Too Many Requests if limit exceeded
- **AND** SHALL display remaining export attempts in UI

#### Scenario: Export access control

- **GIVEN** a share export is requested
- **WHEN** access is validated
- **THEN** the system SHALL require valid authentication session
- **AND** SHALL verify user owns the secret
- **AND** SHALL verify user has Pro tier subscription
- **AND** SHALL reject Free tier users with upgrade prompt

#### Scenario: Free tier restriction

- **GIVEN** a Free tier user views secret detail
- **WHEN** the export option is displayed
- **THEN** the system SHALL show disabled export button
- **AND** SHALL display "Pro feature" badge
- **AND** SHALL link to pricing page for upgrade

### Requirement: Backup Reminder System

The system SHALL periodically remind Pro users to backup their shares.

#### Scenario: Quarterly backup reminder

- **GIVEN** a Pro user has secrets with exportable shares
- **WHEN** 90 days have passed since last export (or never exported)
- **THEN** the system SHALL send backup reminder email
- **AND** SHALL include link to export each secret
- **AND** SHALL explain importance of share backup

#### Scenario: Reminder preference

- **GIVEN** a user receives backup reminders
- **WHEN** the user visits account settings
- **THEN** the system SHALL provide option to disable backup reminders
- **AND** SHALL default to reminders enabled
- **AND** SHALL respect user preference in future emails

### Requirement: Offline Reconstruction Documentation

The system SHALL provide documentation for reconstructing secrets without KeyFate.

#### Scenario: Reconstruction guide availability

- **GIVEN** a user has exported shares
- **WHEN** the user needs to reconstruct offline
- **THEN** the system SHALL provide downloadable reconstruction guide
- **AND** SHALL include open-source tool references
- **AND** SHALL include step-by-step instructions
- **AND** SHALL include troubleshooting section

#### Scenario: Tool compatibility

- **GIVEN** an exported share file
- **WHEN** used with documented reconstruction tools
- **THEN** the system SHALL ensure format compatibility
- **AND** SHALL maintain backward compatibility with previous export versions
- **AND** SHALL document version migration if format changes
