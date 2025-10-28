# Analytics Specification

## ADDED Requirements

### Requirement: PostHog SDK Integration

The system SHALL integrate PostHog for product analytics, session replay, error
tracking, and performance monitoring while maintaining user privacy and data
security.

#### Scenario: Initialize PostHog on application load

- **GIVEN** the application starts
- **WHEN** the root layout component renders
- **THEN** PostHog SHALL be initialized with the project API key
- **AND** PostHog SHALL be configured with privacy-preserving defaults
- **AND** session replay SHALL be enabled with appropriate masking
- **AND** automatic event capture SHALL be enabled for pageviews
- **AND** the initialization SHALL not block page rendering

#### Scenario: PostHog initialization fails gracefully

- **GIVEN** PostHog API key is invalid or network is unavailable
- **WHEN** PostHog initialization is attempted
- **THEN** the initialization SHALL fail silently without breaking the
  application
- **AND** analytics events SHALL be queued (optional) or dropped
- **AND** an error SHALL be logged for monitoring
- **AND** the application SHALL function normally without analytics

### Requirement: Event Tracking

The system SHALL track key user actions and application events to understand
product usage, user behavior, and feature adoption.

#### Scenario: Track user authentication events

- **GIVEN** a user signs in successfully
- **WHEN** authentication completes
- **THEN** a "user_signed_in" event SHALL be captured
- **AND** the event properties SHALL include authentication method (otp, google)
- **AND** the event properties SHALL NOT include passwords or tokens
- **AND** the user SHALL be identified with a hashed user ID

#### Scenario: Track secret creation

- **GIVEN** a user creates a new secret
- **WHEN** the secret is saved successfully
- **THEN** a "secret_created" event SHALL be captured
- **AND** the event properties SHALL include tier (free, pro)
- **AND** the event properties SHALL include threshold (2-of-3, 3-of-5, etc.)
- **AND** the event properties SHALL include check-in interval (days)
- **AND** the event properties SHALL NOT include secret content or shares

#### Scenario: Track check-in events

- **GIVEN** a user performs a check-in
- **WHEN** the check-in is processed
- **THEN** a "check_in_completed" event SHALL be captured
- **AND** the event SHALL include time since last check-in
- **AND** the event SHALL include whether it was on-time or late
- **AND** server-side tracking SHALL correlate with client-side events

#### Scenario: Track payment events

- **GIVEN** a user initiates a subscription checkout
- **WHEN** the Stripe/BTCPay checkout session is created
- **THEN** a "checkout_started" event SHALL be captured
- **AND** the event properties SHALL include plan (monthly, annual)
- **AND** the event properties SHALL include payment provider (stripe, btcpay)
- **AND** when payment succeeds, a "subscription_created" event SHALL be
  captured

### Requirement: Error Tracking

The system SHALL capture client-side and server-side errors with sufficient
context for debugging while respecting user privacy.

#### Scenario: Capture client-side error

- **GIVEN** a client-side JavaScript error occurs
- **WHEN** the error is thrown
- **THEN** PostHog SHALL capture the error automatically
- **AND** the error SHALL include stack trace
- **AND** the error SHALL include user context (if available)
- **AND** the error SHALL include page URL and browser info
- **AND** sensitive data SHALL be sanitized before capture

#### Scenario: Capture server-side error

- **GIVEN** an API route throws an error
- **WHEN** the error is caught by the logger
- **THEN** the error SHALL be sent to PostHog
- **AND** the error SHALL include request context (method, path)
- **AND** the error SHALL include user ID (if authenticated)
- **AND** the error SHALL NOT include request bodies with sensitive data
- **AND** the error SHALL be grouped by type for analysis

### Requirement: Performance Monitoring

The system SHALL monitor application performance metrics including Core Web
Vitals, API response times, and database query performance.

#### Scenario: Track Core Web Vitals

- **GIVEN** a page loads in the browser
- **WHEN** Core Web Vitals are measured
- **THEN** LCP (Largest Contentful Paint) SHALL be captured
- **AND** FID (First Input Delay) SHALL be captured
- **AND** CLS (Cumulative Layout Shift) SHALL be captured
- **AND** performance metrics SHALL be sent to PostHog
- **AND** metrics SHALL be tagged with page route

#### Scenario: Track API response times

- **GIVEN** an API request is processed
- **WHEN** the request completes
- **THEN** the response time SHALL be tracked
- **AND** the event SHALL include endpoint path
- **AND** the event SHALL include HTTP status code
- **AND** the event SHALL include whether it was a success or failure
- **AND** slow requests (>500ms) SHALL be highlighted

### Requirement: Session Replay

The system SHALL record user sessions with privacy controls to enable debugging
of production issues without compromising sensitive data.

#### Scenario: Record user session

- **GIVEN** a user interacts with the application
- **WHEN** session replay is enabled (10% sample rate)
- **THEN** user interactions SHALL be recorded
- **AND** DOM snapshots SHALL be captured
- **AND** sensitive input fields SHALL be masked (passwords, secrets, tokens)
- **AND** the recording SHALL be associated with the user session
- **AND** the recording SHALL be viewable in PostHog dashboard

#### Scenario: Record session on error

- **GIVEN** a JavaScript error occurs
- **WHEN** the error is captured
- **THEN** the session replay SHALL be saved (100% capture rate for errors)
- **AND** the replay SHALL include 30 seconds before the error
- **AND** the replay SHALL help debug the error context
- **AND** sensitive data SHALL remain masked

### Requirement: Feature Flags

The system SHALL support feature flags for gradual rollouts, A/B testing, and
feature toggles without code deployments.

#### Scenario: Evaluate feature flag client-side

- **GIVEN** a feature flag "new-dashboard-ui" exists in PostHog
- **WHEN** a React component checks the flag
- **THEN** the flag value SHALL be retrieved from PostHog
- **AND** the flag SHALL return true or false based on configuration
- **AND** the flag evaluation SHALL not block rendering
- **AND** the default value SHALL be used if evaluation fails

#### Scenario: Evaluate feature flag server-side

- **GIVEN** an API route needs to check a feature flag
- **WHEN** the route processes a request
- **THEN** the flag SHALL be evaluated using PostHog Node.js SDK
- **AND** the evaluation SHALL include user context for targeting
- **AND** the flag value SHALL determine code path
- **AND** flag evaluations SHALL be fast (<10ms)

### Requirement: Privacy & Data Protection

The system SHALL ensure that analytics data collection respects user privacy,
complies with GDPR, and prevents collection of personally identifiable
information (PII).

#### Scenario: Sanitize sensitive data before tracking

- **GIVEN** an event contains potentially sensitive data
- **WHEN** the event is captured
- **THEN** passwords SHALL be removed
- **AND** email addresses SHALL be hashed or removed
- **AND** secret content SHALL never be included
- **AND** server shares SHALL never be included
- **AND** authentication tokens SHALL be removed

#### Scenario: User opts out of analytics

- **GIVEN** a user wants to opt out of analytics
- **WHEN** the user toggles the opt-out setting
- **THEN** PostHog SHALL stop tracking events for that user
- **AND** existing data SHALL be retained per retention policy
- **AND** session replay SHALL be disabled for that user
- **AND** the opt-out SHALL persist across sessions

#### Scenario: Data retention compliance

- **GIVEN** analytics data is stored in PostHog
- **WHEN** data retention period is reached (90 days)
- **THEN** old events SHALL be automatically deleted
- **AND** session replays SHALL be deleted after retention period
- **AND** retention policy SHALL be documented in Privacy Policy

### Requirement: Analytics Dashboard & Insights

The system SHALL provide dashboards and insights for monitoring application
health, user engagement, and product metrics.

#### Scenario: View key product metrics dashboard

- **GIVEN** the team accesses PostHog dashboard
- **WHEN** viewing the "Product Metrics" dashboard
- **THEN** active users (DAU, WAU, MAU) SHALL be displayed
- **AND** secret creation rate SHALL be displayed
- **AND** check-in success rate SHALL be displayed
- **AND** tier conversion rate SHALL be displayed
- **AND** metrics SHALL be visualized with charts

#### Scenario: Alert on critical metric drop

- **GIVEN** a critical metric drops below threshold (e.g., check-in success rate
  < 95%)
- **WHEN** PostHog evaluates the alert condition
- **THEN** an alert SHALL be sent via configured channel (email, Slack)
- **AND** the alert SHALL include the metric value
- **AND** the alert SHALL include a link to the dashboard
- **AND** the alert SHALL help the team respond quickly

### Requirement: Integration with Existing Logger

The system SHALL integrate PostHog error tracking with the existing logger
implementation to provide unified error monitoring.

#### Scenario: Logger sends errors to PostHog

- **GIVEN** the application logger captures an error
- **WHEN** `logger.error()` is called
- **THEN** the error SHALL be sent to both console and PostHog
- **AND** the error SHALL include sanitized context
- **AND** PostHog SHALL group similar errors together
- **AND** the integration SHALL not require code changes in existing error
  handlers
