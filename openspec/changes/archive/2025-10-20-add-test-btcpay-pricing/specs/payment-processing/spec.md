# Payment Processing - Delta Spec

## ADDED Requirements

### Requirement: Environment-Based BTCPay Pricing

The BTCPayProvider SHALL return different pricing tiers based on the deployment environment to enable low-cost testing in development and staging while maintaining production pricing in production.

#### Scenario: Dev environment returns test pricing

- **GIVEN** the environment variable NEXT_PUBLIC_ENV is set to "local" or "development"
- **WHEN** listPrices() is called on BTCPayProvider
- **THEN** the system SHALL return test pricing with monthly price of 0.00000010 BTC (10 sats)
- **AND** yearly price of 0.00000100 BTC (100 sats)

#### Scenario: Staging environment returns test pricing

- **GIVEN** the environment variable NEXT_PUBLIC_ENV is set to "staging"
- **WHEN** listPrices() is called on BTCPayProvider
- **THEN** the system SHALL return test pricing with monthly price of 0.00000010 BTC (10 sats)
- **AND** yearly price of 0.00000100 BTC (100 sats)

#### Scenario: Production environment returns production pricing

- **GIVEN** the environment variable NEXT_PUBLIC_ENV is set to "production" or "prod"
- **WHEN** listPrices() is called on BTCPayProvider
- **THEN** the system SHALL return production pricing with monthly price of 0.0002 BTC (20000 sats)
- **AND** yearly price of 0.002 BTC (200000 sats)

#### Scenario: Undefined environment defaults to production pricing

- **GIVEN** the environment variable NEXT_PUBLIC_ENV is not set or is undefined
- **WHEN** listPrices() is called on BTCPayProvider
- **THEN** the system SHALL return production pricing as a safe default
- **AND** monthly price SHALL be 0.0002 BTC (20000 sats)
- **AND** yearly price SHALL be 0.002 BTC (200000 sats)

### Requirement: Test Pricing Values

The test pricing for BTCPay SHALL be significantly lower than production pricing to minimize costs during development and testing cycles.

#### Scenario: Test pricing is minimal for low-cost testing

- **GIVEN** test pricing is configured for dev or staging environments
- **WHEN** comparing test prices to production prices
- **THEN** test monthly price SHALL be 0.00000010 BTC (10 sats, 0.05% of production 20000 sats)
- **AND** test yearly price SHALL be 0.00000100 BTC (100 sats, 0.05% of production 200000 sats)

#### Scenario: Test pricing maintains interval ratio

- **GIVEN** test pricing is configured
- **WHEN** comparing monthly to yearly pricing
- **THEN** yearly price SHALL be exactly 10x the monthly price
- **AND** this ratio SHALL match the production pricing ratio

### Requirement: Environment Detection

The BTCPayProvider SHALL detect the current environment using the NEXT_PUBLIC_ENV environment variable.

#### Scenario: Environment detection reads from process.env

- **GIVEN** the application is running
- **WHEN** BTCPayProvider needs to determine pricing
- **THEN** it SHALL read the NEXT_PUBLIC_ENV variable from process.env
- **AND** SHALL normalize the value to lowercase for comparison

#### Scenario: Recognized environment values

- **GIVEN** NEXT_PUBLIC_ENV is set
- **WHEN** determining which pricing to use
- **THEN** the following values SHALL be recognized as non-production: "local", "development", "dev", "staging", "stage"
- **AND** the following values SHALL be recognized as production: "production", "prod"
- **AND** any unrecognized value SHALL default to production pricing

### Requirement: Backward Compatibility

The environment-based pricing changes SHALL NOT affect existing production deployments or break existing payment flows.

#### Scenario: Existing production pricing unchanged

- **GIVEN** a production environment with NEXT_PUBLIC_ENV set to "production"
- **WHEN** listPrices() is called
- **THEN** the returned prices SHALL exactly match the previous hardcoded values
- **AND** monthly price SHALL be 0.0002 BTC
- **AND** yearly price SHALL be 0.002 BTC

#### Scenario: No breaking changes to PaymentProvider interface

- **GIVEN** the BTCPayProvider implements the PaymentProvider interface
- **WHEN** environment-based pricing is added
- **THEN** the listPrices() method signature SHALL remain unchanged
- **AND** the return type SHALL remain Promise<Price[]>
- **AND** all existing callers SHALL continue to work without modification
