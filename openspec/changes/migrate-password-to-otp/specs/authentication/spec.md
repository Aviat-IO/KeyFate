## ADDED Requirements

### Requirement: OTP Generation

The system SHALL generate a one-time password (OTP) when a user requests
authentication.

#### Scenario: OTP generation on signin request (unified flow)

- **WHEN** a user submits their email address on `/auth/signin`
- **THEN** a 6-digit numeric OTP is generated and stored with 10-minute
  expiration
- **AND** the OTP is sent to the user's email address
- **AND** any previous unused OTPs for that email are marked as expired (expires
  = NOW())
- **AND** the system does NOT reveal whether the email exists in the database
- **AND** expired OTPs are soft-deleted (kept for audit trail, not physically
  removed)

#### Scenario: Rate limiting OTP requests

- **WHEN** a user requests more than 3 OTPs within 1 hour
- **THEN** the request is rejected with "too many attempts" error
- **AND** the user must wait until the rate limit window expires

### Requirement: OTP Validation

The system SHALL validate OTP codes submitted by users for authentication.

#### Scenario: Successful OTP validation (existing user)

- **WHEN** an existing user submits a valid, unexpired OTP code
- **THEN** the OTP is marked as used atomically (preventing race conditions)
- **AND** a new authenticated session is created for the user
- **AND** the user is redirected to their intended destination (callbackUrl) or
  /dashboard

#### Scenario: Successful OTP validation (new user - auto-signup)

- **WHEN** a new user (email never seen before) submits a valid, unexpired OTP
  code
- **THEN** the OTP is marked as used atomically
- **AND** a new user account is created automatically
- **AND** a new authenticated session is created for the user
- **AND** the user is redirected to onboarding or /dashboard

#### Scenario: Concurrent OTP validation attempts

- **WHEN** the same OTP code is submitted twice simultaneously
- **THEN** only the first request succeeds (atomic database operation)
- **AND** the second request fails with "code already used" error
- **AND** the OTP is marked as used exactly once

#### Scenario: Invalid OTP code

- **WHEN** a user submits an OTP code that does not match the stored code
- **THEN** the authentication fails with "invalid code" error
- **AND** the attempt is counted toward the validation attempt limit

#### Scenario: Expired OTP code

- **WHEN** a user submits an OTP code that has exceeded the 10-minute expiration
- **THEN** the authentication fails with "code expired" error
- **AND** the user is prompted to request a new code

#### Scenario: Too many validation attempts

- **WHEN** a user submits 5 incorrect OTP codes for the same email
- **THEN** all OTP codes for that email are invalidated
- **AND** the user must request a new OTP

### Requirement: OTP Email Delivery

The system SHALL send OTP codes to users via email using the configured email
provider.

#### Scenario: OTP email sent successfully

- **WHEN** an OTP is generated for a user
- **THEN** an email containing the 6-digit code is sent to the user's email
  address
- **AND** the email includes the expiration time (10 minutes)
- **AND** the email includes a security warning about not sharing the code

#### Scenario: OTP email delivery failure with retry

- **WHEN** the email provider fails to send the OTP email
- **THEN** the system attempts up to 2 retries with exponential backoff (1s, 3s)
- **AND** the error is logged to the email_failures table with retry metadata
- **AND** if all retries fail, the user is shown "Email delivery failed. Please
  try again in 1 minute"
- **AND** the OTP remains valid for its full 10-minute TTL (user may have
  received it despite error)
- **AND** the failed request counts toward rate limiting (prevents retry spam)

### Requirement: OTP Storage

The system SHALL store OTP codes securely in the database with appropriate
metadata.

#### Scenario: OTP stored with metadata

- **WHEN** an OTP is generated
- **THEN** it is stored in the verification_tokens table with purpose =
  'authentication'
- **AND** includes the email identifier, expiration timestamp, and creation
  timestamp
- **AND** includes a usage counter initialized to 0

#### Scenario: OTP cleanup on expiration

- **WHEN** an OTP expires (10 minutes after creation)
- **THEN** it is marked as expired in the database
- **AND** it cannot be used for authentication

#### Scenario: Automated OTP cleanup (GDPR compliance)

- **WHEN** a daily cleanup job runs
- **THEN** all OTPs with `purpose = 'authentication'` AND
  `expires < NOW() -
INTERVAL '24 hours'` are deleted
- **AND** all rate limit records with `window_end < NOW() - INTERVAL '24 hours'`
  are deleted

### Requirement: OTP Format

The system SHALL use a consistent format for OTP codes.

#### Scenario: 6-digit numeric OTP format

- **WHEN** an OTP is generated
- **THEN** it consists of exactly 6 numeric digits (0-9)
- **AND** it is generated using `crypto.randomInt(0, 999999)` padded to 6 digits
- **AND** it has no leading zeros stripped (e.g., "000123" is valid)
- **AND** if a collision is detected (same code exists for same email,
  unlikely), regenerate up to 3 times

### Requirement: Rate Limit Storage

The system SHALL track OTP request rates in a dedicated table.

#### Scenario: Rate limit tracking

- **WHEN** an OTP is requested
- **THEN** a record is created/updated in otp_rate_limits table
- **AND** includes email, request_count, window_start, window_end
- **AND** old records (>24 hours) are automatically cleaned up by daily job

## MODIFIED Requirements

### Requirement: Unified Authentication Flow

The system SHALL provide a unified authentication flow at `/auth/signin` that
handles both new user registration and existing user login via OTP.

#### Scenario: Unified signin flow

- **WHEN** a user visits `/auth/signin`
- **THEN** they SHALL see a single email input field (no password field visible)
- **AND** they can request an OTP by clicking "Send Code"
- **AND** after receiving OTP, they enter it on the same page
- **AND** the system automatically determines if this is signup or login based
  on email existence

**Previous behavior**: Separate `/auth/register` and `/auth/login` routes with
password-based authentication

**Migration**: Hide password UI elements, merge register and login routes, keep
password backend code for potential future use

### Requirement: Password Authentication (Hidden, Not Removed)

The system SHALL maintain password authentication backend code but hide it from
the user interface.

#### Scenario: Password backend remains functional

- **WHEN** password authentication code is needed for emergency use
- **THEN** all password functions (hashing, validation, reset) SHALL remain
  operational
- **AND** the password column in users table SHALL remain (nullable)
- **AND** password UI elements SHALL be hidden via conditional rendering

#### Scenario: Feature flag for password re-enablement

- **WHEN** an emergency requires password authentication
- **THEN** a feature flag can be toggled to show password UI
- **AND** existing password backend code SHALL work without code changes

**Migration**:

- Keep `frontend/src/lib/auth/password.ts` (bcrypt functions)
- Keep `password` column in users table (nullable)
- Keep password reset routes and logic
- Hide password input fields in all frontend forms
- Add feature flag capability to re-enable password UI if needed
