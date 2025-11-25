## ADDED Requirements

### Requirement: Encryption Key Versioning and Rotation

The system SHALL support encryption key versioning to enable safe key rotation
without data loss.

#### Scenario: Key version storage

- **GIVEN** a secret is encrypted
- **WHEN** encryption is performed
- **THEN** the system SHALL include current key version in encrypted data
- **AND** SHALL store key version in secrets table key_version column
- **AND** SHALL default to version 1 for backward compatibility
- **AND** SHALL create database index on key_version for efficient queries

#### Scenario: Multiple active key versions

- **GIVEN** key rotation is in progress
- **WHEN** encryption or decryption is requested
- **THEN** the system SHALL support multiple active key versions simultaneously
- **AND** SHALL encrypt new secrets with latest key version
- **AND** SHALL decrypt existing secrets using their stored key version
- **AND** SHALL load keys from environment variables (ENCRYPTION_KEY_V1,
  ENCRYPTION_KEY_V2, etc.)

#### Scenario: Key entropy validation

- **GIVEN** an encryption key is loaded from environment
- **WHEN** the key is validated at startup
- **THEN** the system SHALL verify key is exactly 32 bytes after base64 decoding
- **AND** SHALL check key has sufficient entropy (at least 16 unique bytes)
- **AND** SHALL reject keys matching weak patterns (all zeros, all 0xFF,
  repeating bytes)
- **AND** SHALL exit with clear error if key validation fails

#### Scenario: Key rotation process

- **GIVEN** a new encryption key version is deployed
- **WHEN** the application starts
- **THEN** the system SHALL load all configured key versions
- **AND** SHALL use latest version for new encryption operations
- **AND** SHALL maintain ability to decrypt with older versions
- **AND** SHALL log active key versions on startup (without exposing key values)

#### Scenario: Backward compatibility

- **GIVEN** secrets exist without key_version column (legacy data)
- **WHEN** decryption is attempted
- **THEN** the system SHALL default to key version 1
- **AND** SHALL successfully decrypt legacy secrets
- **AND** SHALL migrate to versioned format on next update

### Requirement: Secure Memory Handling for Decrypted Secrets

The system SHALL handle decrypted secret content in memory securely to prevent
exposure through memory dumps or garbage collection.

#### Scenario: Buffer-based secret handling

- **GIVEN** a secret needs to be decrypted and processed
- **WHEN** decryption occurs
- **THEN** the system SHALL store decrypted content in Buffer instead of string
- **AND** SHALL minimize buffer lifetime in memory
- **AND** SHALL explicitly zero buffer contents after use
- **AND** SHALL prevent string conversion until absolutely necessary

#### Scenario: Secure buffer cleanup

- **GIVEN** decrypted secret content is stored in a Buffer
- **WHEN** processing is complete or error occurs
- **THEN** the system SHALL zero all bytes in buffer using fill(0)
- **AND** SHALL set buffer reference to null
- **AND** SHALL trigger garbage collection if --expose-gc flag is set
- **AND** SHALL ensure cleanup happens in finally block

#### Scenario: Email disclosure with secure memory

- **GIVEN** a secret is disclosed via email
- **WHEN** email is sent with secret content
- **THEN** the system SHALL keep content in Buffer until email API call
- **AND** SHALL convert to string only at point of use
- **AND** SHALL immediately zero buffer after successful email send
- **AND** SHALL zero buffer even if email send fails

#### Scenario: Production runtime configuration

- **GIVEN** application is deployed to production
- **WHEN** Node.js process starts
- **THEN** the system SHALL run with --expose-gc flag to enable manual garbage
  collection
- **AND** SHALL call global.gc() after handling sensitive data
- **AND** SHALL document memory security requirements in deployment guide

### Requirement: Encryption Algorithm and Configuration

The system SHALL use industry-standard encryption with proper configuration for
all sensitive data.

#### Scenario: AES-256-GCM encryption

- **GIVEN** data needs to be encrypted
- **WHEN** encryption is performed
- **THEN** the system SHALL use AES-256-GCM algorithm
- **AND** SHALL generate unique IV (initialization vector) for each encryption
  operation
- **AND** SHALL use 12-byte IV for optimal GCM performance
- **AND** SHALL generate authentication tag for integrity verification

#### Scenario: Encryption integrity verification

- **GIVEN** encrypted data is stored with auth tag
- **WHEN** decryption is performed
- **THEN** the system SHALL verify auth tag matches
- **AND** SHALL reject tampered ciphertext with clear error
- **AND** SHALL log integrity verification failures for security monitoring
- **AND** SHALL not expose partial plaintext on verification failure

#### Scenario: IV generation and storage

- **GIVEN** encryption operation is performed
- **WHEN** IV is generated
- **THEN** the system SHALL use cryptographically secure random generation
- **AND** SHALL never reuse IV values with the same key
- **AND** SHALL store IV alongside ciphertext in database
- **AND** SHALL base64-encode IV for database storage

## MODIFIED Requirements

### Requirement: Data Retention Policy

The system SHALL implement data retention policies compliant with privacy
regulations and prevent table bloat.

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

#### Scenario: Webhook event retention and cleanup

- **GIVEN** webhook events are stored
- **WHEN** cleanup job runs
- **THEN** the system SHALL delete webhook events older than 30 days using lt()
  comparison operator
- **AND** SHALL log number of deleted events for monitoring
- **AND** SHALL preserve last 30 days for debugging and replay prevention
- **AND** SHALL prevent table bloat from indefinite event accumulation

#### Scenario: Session retention

- **GIVEN** user sessions are created
- **WHEN** sessions expire or user logs out
- **THEN** the system SHALL delete expired sessions after 24 hours
- **AND** SHALL clean up orphaned sessions weekly
- **AND** SHALL include session cleanup in scheduled maintenance jobs

#### Scenario: CSRF token retention

- **GIVEN** CSRF tokens are created
- **WHEN** daily cleanup job runs
- **THEN** the system SHALL delete expired tokens (older than 1 hour)
- **AND** SHALL delete used tokens immediately after validation
- **AND** SHALL prevent token table bloat
- **AND** SHALL log cleanup statistics for monitoring
