# data-protection Spec Delta

## ADDED Requirements

### Requirement: Structured Error Handling

The system SHALL use structured error types that prevent sensitive data
exposure.

#### Scenario: Error type definitions

- **GIVEN** an error occurs during processing
- **WHEN** creating error instance
- **THEN** the system SHALL use typed error classes (SecretProcessingError,
  AuthenticationError, etc.)
- **AND** SHALL include error code from predefined enum
- **AND** SHALL include safe context fields only (IDs, codes, not values)
- **AND** SHALL exclude sensitive data from error message

#### Scenario: Error serialization

- **GIVEN** an error needs to be logged or returned to client
- **WHEN** serializing error to JSON
- **THEN** the system SHALL use toJSON() method with explicit allow-list
- **AND** SHALL include only: error code, secret ID, timestamp, request ID
- **AND** SHALL exclude: encryption keys, server shares, PII, passwords
- **AND** SHALL exclude context object completely

#### Scenario: Error logging

- **GIVEN** an error is logged server-side
- **WHEN** writing to log system
- **THEN** the system SHALL use structured logging format (JSON)
- **AND** SHALL include error code and safe identifiers
- **AND** SHALL NOT include sensitive context values
- **AND** SHALL include request ID for correlation

#### Scenario: Client error responses

- **GIVEN** an error needs to be returned to client
- **WHEN** creating HTTP error response
- **THEN** the system SHALL return generic message for internal errors
- **AND** SHALL return specific message only for validation errors
- **AND** SHALL include error code for client-side handling
- **AND** SHALL never include stack traces or internal details

### Requirement: Encryption Key Rotation

The system SHALL support encryption key rotation with backward compatibility.

#### Scenario: New key generation

- **GIVEN** key rotation is triggered
- **WHEN** generating new encryption key
- **THEN** the system SHALL increment current key version
- **AND** SHALL generate cryptographically secure 32-byte key
- **AND** SHALL store in Google Secret Manager (not environment variables)
- **AND** SHALL update CURRENT_KEY_VERSION global

#### Scenario: Re-encryption of existing data

- **GIVEN** new encryption key is available
- **WHEN** re-encryption job runs
- **THEN** the system SHALL query secrets with old key version
- **AND** SHALL process in batches of 100 secrets
- **AND** SHALL decrypt using old key version
- **AND** SHALL re-encrypt using new key version
- **AND** SHALL update key_version field atomically

#### Scenario: Re-encryption progress tracking

- **GIVEN** re-encryption job is running
- **WHEN** processing secrets
- **THEN** the system SHALL track progress in database table
- **AND** SHALL record: total secrets, processed count, start time, last updated
- **AND** SHALL allow job resumption if interrupted
- **AND** SHALL cleanup progress tracking when complete

#### Scenario: Multi-version key support

- **GIVEN** secrets encrypted with different key versions
- **WHEN** decrypting a secret
- **THEN** the system SHALL read key_version from secret record
- **AND** SHALL retrieve correct key from key map
- **AND** SHALL fail with clear error if key version not found
- **AND** SHALL maintain old keys for at least 90 days after rotation

### Requirement: OTP Security Enhancement

The system SHALL implement enhanced OTP security to prevent brute force attacks.

#### Scenario: Increased OTP length

- **GIVEN** an OTP is generated
- **WHEN** creating verification code
- **THEN** the system SHALL generate 10-digit code (1 billion possibilities)
- **AND** SHALL use cryptographically secure random number generator
- **AND** SHALL format with leading zeros if needed

#### Scenario: Global rate limiting per email

- **GIVEN** OTP validation attempts are made
- **WHEN** checking rate limits
- **THEN** the system SHALL count attempts across all IP addresses
- **AND** SHALL limit to 20 attempts per hour per email
- **AND** SHALL query verification_tokens table for attempt count
- **AND** SHALL reject with account lockout message if exceeded

#### Scenario: Account lockout

- **GIVEN** excessive OTP attempts detected
- **WHEN** global rate limit exceeded (50+ attempts in 24 hours)
- **THEN** the system SHALL lock account for 24 hours
- **AND** SHALL send security alert email to account owner
- **AND** SHALL log security event with IP addresses involved
- **AND** SHALL require manual unlock or wait for cooldown period
