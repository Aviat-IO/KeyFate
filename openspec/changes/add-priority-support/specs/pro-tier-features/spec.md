## ADDED Requirements

### Requirement: Priority Support Contact Display

The system SHALL display the support email address (support@aviat.io) to Pro tier users in the pricing page and Pro welcome modal.

#### Scenario: Pro user views pricing page
- **WHEN** a Pro user views the pricing page
- **THEN** the Pro tier card displays "Priority email support (support@aviat.io)" as a feature

#### Scenario: User upgrades to Pro
- **WHEN** a user completes Pro subscription payment
- **THEN** a "Welcome to Pro!" modal appears with all Pro features including support email

#### Scenario: Pro user clicks Pro banner
- **WHEN** a Pro user clicks the "Pro" banner in the navbar
- **THEN** the "Welcome to Pro!" modal displays with all Pro features including support email

### Requirement: Pro Features Constant

The system SHALL maintain a centralized constant defining all Pro tier features for consistency across the application.

#### Scenario: Feature list reference
- **WHEN** any component needs to display Pro features
- **THEN** it imports and uses the PRO_FEATURES constant from `frontend/src/constants/pro-features.ts`

#### Scenario: Feature structure
- **WHEN** accessing a Pro feature from the constant
- **THEN** it includes `title`, `description`, and optional `features` array (string[])
