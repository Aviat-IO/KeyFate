## ADDED Requirements

### Requirement: Password Reset Request

The system SHALL provide a password reset request mechanism for users with
email/password credentials.

#### Scenario: Valid password reset request

- **GIVEN** a user with verified email and existing password
- **WHEN** the user submits their email address on the forgot password page
- **THEN** a password reset email is sent with a secure reset link
- **AND** a reset token is stored in the database with 1-hour expiration

#### Scenario: Password reset request for unverified email

- **GIVEN** a user with unverified email address
- **WHEN** the user submits their email address for password reset
- **THEN** the system responds with a generic success message (no token sent)
- **AND** no reset email is sent
- **AND** no reset token is created

#### Scenario: Password reset request for OAuth-only user

- **GIVEN** a user who signed up with Google OAuth and has no password
- **WHEN** the user submits their email address for password reset
- **THEN** the system responds with a generic success message
- **AND** no reset email is sent
- **AND** no reset token is created

#### Scenario: Password reset request for non-existent email

- **GIVEN** an email address that doesn't exist in the system
- **WHEN** a user submits that email for password reset
- **THEN** the system responds with a generic success message (to prevent email
  enumeration)
- **AND** no email is sent
- **AND** no token is created

#### Scenario: Multiple password reset requests

- **GIVEN** a user has already requested a password reset
- **WHEN** the user requests another password reset before the first expires
- **THEN** the previous reset token is invalidated
- **AND** a new reset token is created
- **AND** a new reset email is sent

#### Scenario: Rate limit exceeded

- **GIVEN** a user has requested 3 password resets in the past hour
- **WHEN** the user attempts another password reset request
- **THEN** the request is rejected with error "Too many password reset requests.
  Please try again later."
- **AND** no email is sent
- **AND** no token is created
- **AND** a retry-after time is provided in the response

### Requirement: Password Reset Token Generation

The system SHALL generate cryptographically secure password reset tokens.

#### Scenario: Token generation

- **WHEN** a valid password reset is requested
- **THEN** a token is generated using crypto.randomBytes(32).toString('hex')
- **AND** the token is 64 characters long
- **AND** the token is unique in the database
- **AND** the token expires 1 hour from creation

#### Scenario: Token storage

- **WHEN** a reset token is generated
- **THEN** it is stored in the password_reset_tokens table
- **AND** it is associated with the user's ID
- **AND** it includes an expiration timestamp
- **AND** previous tokens for the same user are deleted

### Requirement: Password Reset Email

The system SHALL send password reset emails using the existing email
infrastructure.

#### Scenario: Email content

- **GIVEN** a valid password reset request
- **WHEN** the reset email is sent
- **THEN** it contains a reset link with the token as a query parameter
- **AND** it includes instructions for completing the reset
- **AND** it states the link expires in 1 hour
- **AND** it includes a security notice: "If you didn't request this, ignore
  this email"

#### Scenario: Email delivery failure

- **GIVEN** a password reset email fails to send
- **WHEN** the email delivery fails
- **THEN** the failure is logged to the email_delivery_failures table
- **AND** the reset token remains valid (user can try again)
- **AND** an error is returned to the user

### Requirement: Password Reset Completion

The system SHALL allow users to complete password reset using a valid token,
with enhanced password requirements and rate limiting.

#### Scenario: Valid token and password

- **GIVEN** a user with a valid, unexpired reset token
- **WHEN** the user submits a new password meeting requirements
- **THEN** the password is hashed and stored in the database
- **AND** the reset token is deleted
- **AND** all active sessions for the user are invalidated
- **AND** the user is redirected to sign-in page with success message

#### Scenario: Expired token

- **GIVEN** a reset token that is more than 1 hour old
- **WHEN** the user attempts to use it
- **THEN** an error message is displayed: "Reset link has expired"
- **AND** the user is prompted to request a new reset link
- **AND** the password is not changed

#### Scenario: Invalid token

- **GIVEN** an invalid or non-existent reset token
- **WHEN** the user attempts to use it
- **THEN** an error message is displayed: "Invalid reset link"
- **AND** the user is prompted to request a new reset link
- **AND** the password is not changed

#### Scenario: Password validation failure

- **GIVEN** a valid reset token
- **WHEN** the user submits a password that doesn't meet requirements (minimum
  10 characters, 1 uppercase, 1 number, 1 symbol)
- **THEN** validation errors are displayed specifying which requirement failed
- **AND** the password is not changed
- **AND** the token remains valid for retry

#### Scenario: Rate limit on reset attempts

- **GIVEN** a user has attempted 5 password resets in the past hour
- **WHEN** the user attempts another reset
- **THEN** the request is rejected with error "Too many password reset attempts.
  Please try again later."
- **AND** the password is not changed
- **AND** a retry-after time is provided

#### Scenario: Token already used

- **GIVEN** a reset token that has already been used
- **WHEN** the user attempts to use it again
- **THEN** an error message is displayed: "Reset link has already been used"
- **AND** the user is prompted to request a new reset link

### Requirement: Middleware Route Exemptions

The system SHALL allow unauthenticated access to password reset pages.

#### Scenario: Public route access

- **GIVEN** an unauthenticated user
- **WHEN** accessing /auth/forgot-password or /auth/reset-password
- **THEN** the page loads without authentication redirect
- **AND** the user can submit the forms

#### Scenario: API endpoint access

- **GIVEN** an unauthenticated request
- **WHEN** calling /api/auth/request-password-reset or /api/auth/reset-password
- **THEN** the endpoints process the request without authentication
- **AND** appropriate responses are returned

### Requirement: Sign-In Page Integration

The system SHALL provide easy access to password reset from the sign-in page.

#### Scenario: Forgot password link

- **GIVEN** a user on the sign-in page
- **WHEN** viewing the page
- **THEN** a "Forgot password?" link is visible below the password field
- **AND** clicking the link navigates to /auth/forgot-password

### Requirement: Database Schema

The system SHALL maintain a password_reset_tokens table for token storage.

#### Scenario: Table structure

- **GIVEN** the database schema
- **THEN** a password_reset_tokens table exists with columns:
  - id (uuid, primary key)
  - user_id (text, foreign key to users.id with cascade delete)
  - token (text, unique, indexed)
  - expires (timestamp)
  - created_at (timestamp)

#### Scenario: Token cleanup

- **GIVEN** expired reset tokens in the database
- **WHEN** a new reset is requested or a scheduled cleanup runs
- **THEN** expired tokens are deleted
- **AND** only active tokens remain

### Requirement: Session Invalidation

The system SHALL invalidate all active sessions when password is reset.

#### Scenario: Session cleanup on password reset

- **GIVEN** a user with multiple active sessions
- **WHEN** the user completes a password reset
- **THEN** all sessions in the sessions table for that user are deleted
- **AND** the user must sign in again with the new password

### Requirement: Rate Limiting

The system SHALL implement rate limiting to prevent abuse of password reset functionality.

#### Scenario: Password reset request rate limiting

- **GIVEN** rate limiting is configured for password reset requests
- **THEN** users are limited to 3 password reset requests per hour per email address
- **AND** exceeded requests return 429 status with retry-after header
- **AND** the rate limit window is 60 minutes

#### Scenario: Password reset completion rate limiting

- **GIVEN** rate limiting is configured for password reset attempts
- **THEN** users are limited to 5 password reset attempts per hour per token
- **AND** exceeded attempts return 429 status with retry-after header
- **AND** the rate limit window is 60 minutes

#### Scenario: Rate limit key generation

- **WHEN** rate limiting is applied
- **THEN** the identifier is normalized (lowercase, trimmed)
- **AND** request rate limits use email address as identifier
- **AND** completion rate limits use token as identifier

### Requirement: Enhanced Password Validation

The system SHALL enforce enhanced password complexity requirements for password resets.

#### Scenario: Minimum length requirement

- **GIVEN** a user is setting a new password
- **WHEN** the password is less than 10 characters
- **THEN** validation fails with error "Password must be at least 10 characters long"

#### Scenario: Uppercase letter requirement

- **GIVEN** a user is setting a new password
- **WHEN** the password contains no uppercase letters
- **THEN** validation fails with error "Password must contain at least one uppercase letter"

#### Scenario: Number requirement

- **GIVEN** a user is setting a new password
- **WHEN** the password contains no numbers
- **THEN** validation fails with error "Password must contain at least one number"

#### Scenario: Symbol requirement

- **GIVEN** a user is setting a new password
- **WHEN** the password contains no special characters
- **THEN** validation fails with error "Password must contain at least one special character (!@#$%^&*)"

#### Scenario: Valid password with all requirements

- **GIVEN** a user is setting a new password
- **WHEN** the password is at least 10 characters, contains 1 uppercase, 1 lowercase, 1 number, and 1 symbol
- **THEN** validation passes
- **AND** the password is accepted

### Requirement: Sign-Up Password Validation Consistency

The system SHALL apply the same enhanced password validation requirements to both sign-up and password reset flows.

#### Scenario: Sign-up with enhanced validation

- **GIVEN** a user is signing up with email and password
- **WHEN** the user submits a password
- **THEN** the same validation rules apply as password reset (10 chars, 1 uppercase, 1 number, 1 symbol)
- **AND** validation errors are consistent between sign-up and reset flows

#### Scenario: Client-side validation alignment

- **GIVEN** password input fields on sign-up and sign-in pages
- **THEN** the HTML minLength attribute is set to 10
- **AND** client-side validation checks match server-side validation
- **AND** error messages guide users on all requirements

#### Scenario: Existing user sign-in unaffected

- **GIVEN** an existing user with an 8-character password created before the change
- **WHEN** the user signs in with their existing password
- **THEN** sign-in succeeds (validation not applied at sign-in)
- **AND** the user can continue using the application

#### Scenario: Existing user must meet requirements on reset

- **GIVEN** an existing user with an 8-character password
- **WHEN** the user resets their password
- **THEN** the new password must meet enhanced requirements (10 chars, 1 uppercase, 1 number, 1 symbol)
- **AND** the old 8-character password is no longer acceptable

#### Scenario: Shared validation function

- **GIVEN** password validation logic in lib/auth/password.ts
- **THEN** the same validatePassword() function is used for both sign-up and password reset
- **AND** there is no duplication of validation logic
- **AND** API endpoints /api/auth/register and /api/auth/reset-password use the same function
