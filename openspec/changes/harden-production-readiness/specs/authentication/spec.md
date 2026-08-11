## MODIFIED Requirements

### Requirement: OTP Rate Limiting

The system SHALL scope OTP verification attempts to a currently issued, unexpired challenge and SHALL apply shared endpoint/IP limits without allowing anonymous guesses to create durable victim-account lockout state.

#### Scenario: Guess without active challenge

- **GIVEN** no active OTP challenge exists for an email
- **WHEN** an anonymous caller submits an invalid code
- **THEN** the system SHALL reject the request
- **AND** SHALL NOT create or update account lockout state for that email

#### Scenario: Concurrent invalid guesses

- **GIVEN** an active OTP challenge
- **WHEN** invalid guesses arrive concurrently
- **THEN** the challenge attempt count SHALL increment atomically
- **AND** the challenge SHALL become unusable at its bounded attempt limit

#### Scenario: Successful verification

- **WHEN** the correct code is submitted for an active challenge
- **THEN** the challenge SHALL be consumed exactly once
- **AND** a concurrent replay SHALL fail

#### Scenario: New challenge after expiry

- **GIVEN** a prior challenge expired or exhausted its attempts
- **WHEN** the user requests a new OTP within applicable endpoint limits
- **THEN** the system SHALL create a fresh bounded challenge
- **AND** SHALL NOT require manual account unlock caused solely by invalid OTP guesses

#### Scenario: Per-email validation rate limit

- **GIVEN** an active OTP challenge exists for an email
- **WHEN** its bounded validation-attempt limit is exhausted
- **THEN** the system SHALL reject subsequent attempts against that challenge with 429 status
- **AND** SHALL include retry guidance and log the challenge-scoped violation

#### Scenario: Account lockout after repeated failures

- **GIVEN** repeated invalid guesses target an active OTP challenge
- **WHEN** its failure limit is reached
- **THEN** the system SHALL lock and consume that challenge rather than create durable account-level lockout state
- **AND** SHALL preserve shared endpoint/IP abuse limits and security monitoring

#### Scenario: Rate limit reset

- **GIVEN** a challenge or endpoint identity has been rate limited
- **WHEN** its configured window expires
- **THEN** the shared limiter SHALL reset atomically
- **AND** a newly issued challenge MAY accept authentication attempts
