## MODIFIED Requirements

### Requirement: Authentication Framework

The system SHALL use Auth.js (`@auth/sveltekit`) for authentication, supporting
Google OAuth, email+password credentials, and email OTP login methods. Sessions
SHALL use JWT strategy with 24-hour expiry and hourly refresh.

#### Scenario: Google OAuth login

- **WHEN** a user clicks "Sign in with Google"
- **THEN** Auth.js SHALL redirect to Google's OAuth consent screen
- **AND** on successful authentication, a JWT session SHALL be created
- **AND** the user SHALL be redirected to `/dashboard`

#### Scenario: Credentials login

- **WHEN** a user submits valid email and password
- **THEN** Auth.js credentials provider SHALL verify the password with bcrypt
- **AND** a JWT session SHALL be created

### Requirement: Authentication Middleware

The system SHALL enforce authentication via SvelteKit's `hooks.server.ts` using
Auth.js handle. Protected routes SHALL redirect unauthenticated users to the
sign-in page. The middleware SHALL enforce HTTPS in production and generate
request IDs for tracing.

#### Scenario: Unauthenticated access to protected route

- **WHEN** an unauthenticated user accesses a route under `/(authenticated)/`
- **THEN** the hooks SHALL redirect them to `/sign-in`

#### Scenario: Session available in server code

- **WHEN** a server load function or API route needs the current session
- **THEN** it SHALL access `event.locals.session` (set by Auth.js handle in
  hooks)
