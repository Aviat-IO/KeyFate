## ADDED Requirements

### Requirement: Tier-Based Threshold Configuration

The system SHALL enforce threshold scheme limits based on subscription tier.

#### Scenario: Free tier threshold locked
- **WHEN** a Free tier user creates or edits a secret
- **THEN** the threshold is automatically set to 2-of-3 (threshold=2, total_shares=3) with no configuration option

#### Scenario: Pro tier threshold configuration
- **WHEN** a Pro tier user creates or edits a secret
- **THEN** they can configure threshold from 2 to 7 shares, with threshold between 2 and total_shares

#### Scenario: Invalid threshold rejected
- **WHEN** any user attempts to set threshold > total_shares OR threshold < 2 OR total_shares > 7
- **THEN** the system rejects the configuration with a validation error

### Requirement: Variable Share Generation

The system SHALL generate and distribute Shamir shares according to the configured threshold scheme.

#### Scenario: Pro user creates secret with 3-of-5 scheme
- **WHEN** a Pro user creates a secret with threshold=3 and total_shares=5
- **THEN** the system generates 5 shares where any 3 can reconstruct the secret
- **AND** stores 1 share on server, distributes 2 to recipient(s), user keeps 2

#### Scenario: Pro user creates secret with 4-of-7 scheme
- **WHEN** a Pro user creates a secret with threshold=4 and total_shares=7
- **THEN** the system generates 7 shares where any 4 can reconstruct the secret
- **AND** distributes shares appropriately

#### Scenario: Free user locked to 2-of-3
- **WHEN** a Free user creates a secret
- **THEN** the system generates 3 shares where any 2 can reconstruct the secret (standard configuration)

### Requirement: Threshold Validation

The system SHALL validate threshold configuration at both client and server level.

#### Scenario: Client-side validation
- **WHEN** a user configures threshold in the UI
- **THEN** the form validates threshold ≤ total_shares AND threshold ≥ 2 AND total_shares ≤ tier_max

#### Scenario: Server-side tier enforcement
- **WHEN** the API receives a secret creation request
- **THEN** it validates the threshold scheme matches the user's tier limits
- **AND** rejects requests exceeding tier limits with 403 Forbidden

#### Scenario: Tier downgrade handling
- **WHEN** a Pro user downgrades to Free with existing secrets using > 3 shares
- **THEN** existing secrets remain functional (grandfathered)
- **AND** new secrets are limited to 2-of-3 configuration

### Requirement: Threshold UI Display

The system SHALL display threshold configuration prominently to Pro users and clearly for Free users.

#### Scenario: Pro user threshold selector
- **WHEN** a Pro user creates a secret
- **THEN** a threshold selector allows choosing total shares (3-7) and threshold (2 to total_shares)

#### Scenario: Free user threshold display
- **WHEN** a Free user creates a secret
- **THEN** the threshold displays as "2-of-3 (Standard)" with no configuration option
- **AND** shows an upgrade prompt: "Upgrade to Pro for configurable threshold schemes"

#### Scenario: Secret details threshold display
- **WHEN** any user views secret details
- **THEN** the current threshold scheme displays as "X-of-Y shares"
