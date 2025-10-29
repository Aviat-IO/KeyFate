# Security Capability: Application Logging

## ADDED Requirements

### Requirement: No Sensitive Data in Production Logs

The system SHALL NOT log sensitive data to production application logs,
including but not limited to: passwords, API keys, tokens, secrets, webhook
signatures, session tokens, authentication credentials, personal identifiable
information (PII) such as email addresses, payment information, or database
credentials.

#### Scenario: Webhook signature not logged

- **WHEN** a webhook is received and signature validation occurs
- **THEN** the webhook signature, expected signature, and secret length SHALL
  NOT be logged
- **AND** only validation success/failure status MAY be logged

#### Scenario: User email not logged

- **WHEN** authentication, verification, or user operations occur
- **THEN** user email addresses SHALL NOT be logged
- **AND** only user ID MAY be logged for debugging purposes

#### Scenario: API keys not exposed

- **WHEN** diagnostic or configuration scripts display API key status
- **THEN** actual API key values SHALL NOT be logged (not even partial values)
- **AND** only presence/absence status and key type (test/live) MAY be logged

#### Scenario: Session metadata sanitized

- **WHEN** payment session creation occurs
- **THEN** full session configuration including customer IDs and metadata SHALL
  NOT be logged
- **AND** only non-sensitive session properties (mode, price ID) MAY be logged
  in development

#### Scenario: Database credentials not logged

- **WHEN** database connections are established
- **THEN** database passwords, usernames, and host details SHALL NOT be logged
- **AND** only database name and SSL status MAY be logged in development mode

### Requirement: Development Logging Gated by Environment

The system SHALL gate all detailed debug logging behind explicit development
environment checks (NODE_ENV === 'development' and optional DEBUG_\* flags).

#### Scenario: Debug logging only in development

- **WHEN** debug logging is needed
- **THEN** it SHALL be wrapped in `if (process.env.NODE_ENV === 'development')`
  checks
- **AND** sensitive data SHALL still be sanitized even in development

#### Scenario: Production logging uses structured logger

- **WHEN** logging is needed in production
- **THEN** the structured logger (`frontend/src/lib/logger.ts`) SHALL be used
- **AND** console.log SHALL NOT be used in production code paths

### Requirement: Secure Development Defaults

The system SHALL use secure defaults for development credentials and test data.

#### Scenario: Test passwords are strong

- **WHEN** seed scripts create test users
- **THEN** passwords SHALL be cryptographically random or strong (minimum 16
  characters)
- **AND** a warning SHALL be displayed that credentials are for development only

#### Scenario: Example files use obvious placeholders

- **WHEN** example configuration files contain credentials
- **THEN** placeholders SHALL be obviously fake (e.g.,
  "CHANGE_ME_GENERATE_SECURE_PASSWORD")
- **AND** documentation SHALL warn against using example credentials

### Requirement: Rate Limit Configuration Not Exposed

The system SHALL NOT expose rate limiting configuration details in logs that
could aid attackers.

#### Scenario: OTP rate limits not logged

- **WHEN** OTP rate limiting is enforced
- **THEN** the specific rate limit thresholds SHALL NOT be logged
- **AND** only rate limit exceeded/allowed status MAY be logged

### Requirement: Structured Logger Sanitization

The system SHALL use the existing structured logger
(`frontend/src/lib/logger.ts`) which automatically sanitizes sensitive fields
including: passwords, tokens, secrets, API keys, OTP codes, serverShare,
encryptedShare, privateKey, seedPhrase.

#### Scenario: Logger sanitizes sensitive fields

- **WHEN** any object is logged through the structured logger
- **THEN** sensitive fields SHALL be automatically redacted with "[REDACTED]"
- **AND** nested objects SHALL be recursively sanitized

#### Scenario: Logger used for all production logging

- **WHEN** logging is needed in production code
- **THEN** the structured logger (logger.info, logger.warn, logger.error) SHALL
  be used
- **AND** console.log SHALL NOT be present in production code paths
