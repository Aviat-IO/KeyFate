# Data Protection & Compliance

## ADDED Requirements

### Requirement: Privacy Policy Acceptance Tracking

The system SHALL track user acceptance of privacy policy and terms of service
for compliance.

#### Scenario: Privacy policy acceptance on signup

- **GIVEN** a new user is creating an account
- **WHEN** the signup form is displayed
- **THEN** the system SHALL require explicit checkbox for privacy policy
  acceptance
- **AND** SHALL require explicit checkbox for terms of service acceptance
- **AND** SHALL not allow account creation without both acceptances

#### Scenario: Acceptance recording

- **GIVEN** a user accepts privacy policy and terms
- **WHEN** the acceptance occurs
- **THEN** the system SHALL record the acceptance timestamp
- **AND** SHALL record the user's IP address
- **AND** SHALL record the policy version accepted
- **AND** SHALL store in privacy_policy_acceptance table

#### Scenario: Policy update re-acceptance

- **GIVEN** privacy policy or terms are updated
- **WHEN** user logs in after update
- **THEN** the system SHALL prompt for re-acceptance
- **AND** SHALL block access to secret management until re-accepted
- **AND** SHALL show diff of policy changes
- **AND** SHALL record new acceptance with updated version

#### Scenario: Existing user grace period

- **GIVEN** privacy tracking is newly deployed
- **WHEN** existing users log in
- **THEN** the system SHALL grant 30-day grace period for acceptance
- **AND** SHALL show prominent banner prompting acceptance
- **AND** SHALL block secret creation after grace period if not accepted

### Requirement: GDPR Data Export

The system SHALL provide users with ability to export all personal data as
required by GDPR Article 15.

#### Scenario: Data export request

- **GIVEN** a user requests their data export
- **WHEN** the export is generated
- **THEN** the system SHALL include user profile information (email, name,
  created date)
- **AND** SHALL include secrets metadata (title, status, created date, last
  check-in) but NOT encrypted shares
- **AND** SHALL include recipients (email addresses, names)
- **AND** SHALL include audit logs if Pro user
- **AND** SHALL include subscription information
- **AND** SHALL format as JSON for machine readability

#### Scenario: Encrypted shares exclusion

- **GIVEN** a data export is generated
- **WHEN** the export includes secrets
- **THEN** the system SHALL NOT include encrypted server shares
- **AND** SHALL include a note explaining zero-knowledge architecture prevents
  share export
- **AND** SHALL inform user that shares can only be reconstructed via secret
  reveal process

#### Scenario: Export delivery

- **GIVEN** a data export is requested
- **WHEN** the export is complete
- **THEN** the system SHALL send download link via email
- **AND** SHALL expire download link after 7 days
- **AND** SHALL require authentication to download
- **AND** SHALL log export request for audit

### Requirement: GDPR Account Deletion

The system SHALL provide users with ability to delete their account and all
personal data as required by GDPR Article 17 (Right to be Forgotten).

#### Scenario: Account deletion request

- **GIVEN** a user requests account deletion
- **WHEN** the deletion is initiated
- **THEN** the system SHALL require re-authentication via OTP
- **AND** SHALL show confirmation dialog with consequences
- **AND** SHALL inform user about 30-day grace period before permanent deletion

#### Scenario: Soft delete grace period

- **GIVEN** a user confirms account deletion
- **WHEN** deletion is processed
- **THEN** the system SHALL mark account as deleted with 30-day grace period
- **AND** SHALL prevent login but preserve data for 30 days
- **AND** SHALL allow user to cancel deletion within 30 days
- **AND** SHALL send confirmation email with cancellation link

#### Scenario: Permanent deletion

- **GIVEN** account has been soft-deleted for 30 days
- **WHEN** grace period expires
- **THEN** the system SHALL permanently delete user record
- **AND** SHALL cascade delete all secrets
- **AND** SHALL cascade delete all recipients
- **AND** SHALL cascade delete all sessions
- **AND** SHALL cascade delete all audit logs (except required retention for
  Free users: 90 days)
- **AND** SHALL cascade delete subscription information
- **AND** SHALL NOT be reversible

#### Scenario: Triggered secret handling

- **GIVEN** a user requests account deletion
- **WHEN** user has triggered secrets
- **THEN** the system SHALL preserve triggered secrets for 90 days for recipient
  access
- **AND** SHALL delete triggered secrets after 90 days
- **AND** SHALL anonymize user information in triggered secrets (replace with
  "Deleted User")

### Requirement: Data Retention Policy

The system SHALL implement data retention policies compliant with privacy
regulations.

#### Scenario: Audit log retention for Pro users

- **GIVEN** a Pro user generates audit logs
- **WHEN** the logs are created
- **THEN** the system SHALL retain logs indefinitely as long as account is
  active
- **AND** SHALL retain logs for 90 days after account deletion
- **AND** SHALL permanently delete logs after 90-day post-deletion retention

#### Scenario: Audit log retention for Free users

- **GIVEN** a Free user performs auditable actions
- **WHEN** the actions are logged
- **THEN** the system SHALL NOT create persistent audit logs per tier
  limitations
- **AND** SHALL log security events (authentication, access) for 90 days
- **AND** SHALL automatically delete security logs older than 90 days

#### Scenario: Webhook event retention

- **GIVEN** webhook events are stored
- **WHEN** cleanup job runs
- **THEN** the system SHALL delete webhook events older than 30 days
- **AND** SHALL preserve last 30 days for debugging and replay prevention

#### Scenario: Session retention

- **GIVEN** user sessions are created
- **WHEN** sessions expire or user logs out
- **THEN** the system SHALL delete expired sessions after 24 hours
- **AND** SHALL clean up orphaned sessions weekly

### Requirement: Data Processing Agreement

The system SHALL provide Data Processing Agreement (DPA) for business users
requiring GDPR compliance.

#### Scenario: DPA access for Pro users

- **GIVEN** a Pro user needs DPA for business compliance
- **WHEN** the user requests DPA
- **THEN** the system SHALL provide downloadable DPA template
- **AND** SHALL allow electronic signature
- **AND** SHALL store executed DPA for audit

#### Scenario: DPA terms

- **GIVEN** a DPA is provided
- **WHEN** the DPA is reviewed
- **THEN** the document SHALL specify data processing purposes
- **AND** SHALL specify data retention periods
- **AND** SHALL specify security measures implemented
- **AND** SHALL specify user rights (access, deletion, portability)
- **AND** SHALL specify sub-processor disclosure (SendGrid, Stripe, BTCPay,
  Cloud SQL)

### Requirement: Consent Management

The system SHALL manage user consent for optional data processing activities.

#### Scenario: Marketing email consent

- **GIVEN** a user is signing up
- **WHEN** the signup form is shown
- **THEN** the system SHALL provide optional checkbox for marketing emails
- **AND** SHALL default checkbox to unchecked
- **AND** SHALL allow user to change preference in account settings
- **AND** SHALL honor opt-out for all marketing communications

#### Scenario: Analytics consent

- **GIVEN** a user visits the application
- **WHEN** the first page loads
- **THEN** the system SHALL show cookie/analytics consent banner if not
  previously answered
- **AND** SHALL allow granular consent (essential, functional, analytics,
  marketing)
- **AND** SHALL respect user choices and not track without consent
- **AND** SHALL store consent preferences for 12 months

#### Scenario: Consent withdrawal

- **GIVEN** a user has granted consent
- **WHEN** the user withdraws consent in settings
- **THEN** the system SHALL immediately stop the consented processing
- **AND** SHALL delete collected data where possible
- **AND** SHALL log the consent withdrawal

## MODIFIED Requirements

None - All data protection requirements are new additions for GDPR compliance.

## REMOVED Requirements

None - No existing data protection features removed.
