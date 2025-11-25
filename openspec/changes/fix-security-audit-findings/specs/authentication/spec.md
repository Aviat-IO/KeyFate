## ADDED Requirements

### Requirement: Progressive Account Lockout

The system SHALL implement progressive account lockout to prevent brute-force
attacks on authentication while balancing user experience.

#### Scenario: Temporary lockout after 5 failures

- **GIVEN** a user has failed OTP validation
- **WHEN** 5 failed attempts occur for the same email within any timeframe
- **THEN** the system SHALL lock the account for 1 hour
- **AND** SHALL return clear error message indicating lockout duration
- **AND** SHALL record lockout in account_lockouts table
- **AND** SHALL log the lockout event for security monitoring

#### Scenario: Extended lockout after 10 failures

- **GIVEN** a user has failed OTP validation
- **WHEN** 10 failed attempts occur for the same email
- **THEN** the system SHALL lock the account for 24 hours
- **AND** SHALL send email notification to account owner
- **AND** SHALL update lockout record with new duration
- **AND** SHALL log the extended lockout event

#### Scenario: Permanent lockout after 20 failures

- **GIVEN** a user has failed OTP validation
- **WHEN** 20 failed attempts occur for the same email
- **THEN** the system SHALL permanently lock the account
- **AND** SHALL send admin alert for manual review
- **AND** SHALL mark account as permanently_locked in database
- **AND** SHALL return error directing user to contact support
- **AND** SHALL log critical security event

#### Scenario: Lockout check on authentication attempt

- **GIVEN** a user attempts to authenticate
- **WHEN** OTP validation is requested
- **THEN** the system SHALL check account_lockouts table first
- **AND** SHALL reject authentication if account is locked
- **AND** SHALL return remaining lockout time for temporary locks
- **AND** SHALL return support contact information for permanent locks
- **AND** SHALL log attempted access of locked account

#### Scenario: Lockout reset on successful authentication

- **GIVEN** a user successfully authenticates
- **WHEN** validation succeeds
- **THEN** the system SHALL delete any existing lockout record
- **AND** SHALL reset failed attempt counter to zero
- **AND** SHALL allow normal authentication flow to proceed

#### Scenario: Admin lockout override

- **GIVEN** an account is locked (temporary or permanent)
- **WHEN** an administrator unlocks the account via admin endpoint
- **THEN** the system SHALL delete the lockout record
- **AND** SHALL log the admin override action with admin identity
- **AND** SHALL send notification to account owner
- **AND** SHALL reset failed attempt counter

### Requirement: Session Invalidation on Security Events

The system SHALL invalidate user sessions when security-relevant changes occur.

#### Scenario: Session invalidation on password change

- **GIVEN** a user changes their password
- **WHEN** the password change is confirmed
- **THEN** the system SHALL invalidate all existing sessions for that user
- **AND** SHALL require re-authentication on all devices
- **AND** SHALL send notification email about password change
- **AND** SHALL log the session invalidation event

#### Scenario: Session invalidation on account lockout

- **GIVEN** an account is locked due to failed authentication attempts
- **WHEN** the lockout is applied
- **THEN** the system SHALL invalidate all active sessions
- **AND** SHALL prevent new session creation until lockout expires
- **AND** SHALL return appropriate error on locked account access

#### Scenario: Session invalidation on explicit logout

- **GIVEN** a user is logged in
- **WHEN** the user clicks logout
- **THEN** the system SHALL invalidate the current session immediately
- **AND** SHALL clear session cookies
- **AND** SHALL redirect to login page
- **AND** SHALL log the logout event

## MODIFIED Requirements

### Requirement: OTP Rate Limiting

The system SHALL implement per-email and per-IP rate limiting to prevent
brute-force attacks on OTP codes.

#### Scenario: Per-email validation rate limit

- **GIVEN** a user attempts OTP validation
- **WHEN** more than 5 validation attempts occur for the same email within 15
  minutes
- **THEN** the system SHALL reject subsequent attempts with 429 status
- **AND** SHALL include a Retry-After header indicating when attempts can resume
- **AND** SHALL log the rate limit violation for security monitoring

#### Scenario: Per-IP OTP request rate limit

- **GIVEN** OTP requests are made from a specific IP address
- **WHEN** more than 5 OTP requests per minute are made from that IP
- **THEN** the system SHALL reject subsequent requests with 429 status
- **AND** SHALL include Retry-After header
- **AND** SHALL log IP-based rate limit violation
- **AND** SHALL prevent email bombing and quota exhaustion attacks

#### Scenario: Combined email and IP rate limiting

- **GIVEN** a user attempts OTP validation
- **WHEN** rate limits are checked
- **THEN** the system SHALL check IP-based rate limit first
- **AND** SHALL check email-based rate limit second
- **AND** SHALL reject if either limit is exceeded
- **AND** SHALL provide specific error message indicating which limit was hit

#### Scenario: Account lockout after repeated failures

- **GIVEN** a user has failed OTP validation
- **WHEN** failure threshold is reached (5, 10, or 20 attempts)
- **THEN** the system SHALL lock the account per progressive lockout policy
- **AND** SHALL require manual support intervention for permanent locks
- **AND** SHALL send an alert to security monitoring
- **AND** SHALL notify the account owner via email

#### Scenario: Rate limit reset

- **GIVEN** a user has been rate limited
- **WHEN** the rate limit window expires (15 minutes for validation, 1 minute
  for IP requests)
- **THEN** the system SHALL reset the attempt counter
- **AND** SHALL allow new authentication attempts
- **AND** SHALL maintain lockout if account is locked

### Requirement: Strong OTP Generation

The system SHALL generate 8-digit one-time passwords with cryptographically
secure randomness for email-based authentication.

#### Scenario: OTP code generation

- **GIVEN** a user requests authentication
- **WHEN** the system generates an OTP
- **THEN** the code SHALL be exactly 8 numeric digits (00000000-99999999)
- **AND** SHALL be generated using cryptographically secure random number
  generation
- **AND** SHALL have a uniform distribution across all possible values

#### Scenario: OTP expiration

- **GIVEN** an OTP has been generated
- **WHEN** 5 minutes have elapsed since generation
- **THEN** the OTP SHALL be marked as expired
- **AND** SHALL not be accepted for authentication
- **AND** the user SHALL be required to request a new OTP

#### Scenario: OTP storage security

- **GIVEN** an OTP is generated
- **WHEN** stored in database
- **THEN** the system SHALL store hashed OTP value using bcrypt or similar
- **AND** SHALL not store plaintext OTP
- **AND** SHALL include timestamp for expiration checking
- **AND** SHALL delete OTP after successful validation or expiration
