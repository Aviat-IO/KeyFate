# infrastructure Spec Delta

## ADDED Requirements

### Requirement: Alert Configuration Control

The system SHALL provide infrastructure variable to control alert enablement across environments.

#### Scenario: Alert enablement variable

- **GIVEN** infrastructure is being provisioned
- **WHEN** defining Terraform variables
- **THEN** the system SHALL provide enable_alerting boolean variable
- **AND** SHALL default to false for development environments
- **AND** SHALL allow override via Terragrunt tfvars
- **AND** SHALL control notification channel attachment to alert policies

#### Scenario: Environment-specific alert configuration

- **GIVEN** enable_alerting variable is defined
- **WHEN** provisioning dev environment
- **THEN** the system SHALL set enable_alerting to false by default
- **AND** SHALL create alert policies but disable notification delivery
- **WHEN** provisioning staging environment
- **THEN** the system SHALL set enable_alerting to true
- **AND** SHALL enable full alert delivery for testing
- **WHEN** provisioning production environment
- **THEN** the system SHALL set enable_alerting to true
- **AND** SHALL enable full alert delivery for operations

#### Scenario: Alert policy conditional creation

- **GIVEN** alert policies are defined in Terraform
- **WHEN** enable_alerting is false
- **THEN** the system SHALL create alert policies without notification channels
- **AND** SHALL still collect and store metrics
- **AND** SHALL allow alert testing without email spam
- **WHEN** enable_alerting is true
- **THEN** the system SHALL attach notification channels to alert policies
- **AND** SHALL enable alert delivery to support@aviat.io
