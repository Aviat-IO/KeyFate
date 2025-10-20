## ADDED Requirements

### Requirement: Pro-Only Template Access

The system SHALL restrict access to secret message templates to Pro tier users only.

#### Scenario: Pro user accesses templates
- **WHEN** a Pro user creates or edits a secret
- **THEN** the message template selector displays all available templates (Bitcoin Wallet, Password Manager, Estate Documents, Safe Deposit Box, Cryptocurrency Exchange, Cloud Storage, Social Media)

#### Scenario: Free user attempts to access templates
- **WHEN** a Free user creates or edits a secret
- **THEN** the template selector is hidden or disabled with an upgrade prompt

#### Scenario: Server-side template validation
- **WHEN** any API request attempts to use a template
- **THEN** the server validates the user's tier is Pro before allowing template usage

### Requirement: Template Categories

The system SHALL organize message templates into logical categories for easy discovery.

#### Scenario: Template categories available
- **WHEN** a Pro user browses templates
- **THEN** templates are grouped by: Cryptocurrency, Account Access, Legal, Physical Assets, Digital Assets, Digital Legacy

#### Scenario: Template content structure
- **WHEN** a template is selected
- **THEN** it includes: id, title, category, description, and content with placeholder fields in [brackets]

### Requirement: Template Feature Display

The system SHALL prominently display message templates as a Pro tier benefit in marketing and onboarding.

#### Scenario: Pricing page template highlight
- **WHEN** a user views the pricing page
- **THEN** Pro tier lists "7 message templates for common scenarios" as a feature

#### Scenario: Welcome modal template mention
- **WHEN** a user upgrades to Pro
- **THEN** the "Welcome to Pro!" modal highlights message templates with example categories
