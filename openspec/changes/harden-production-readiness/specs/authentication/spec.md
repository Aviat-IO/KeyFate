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
