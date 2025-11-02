# cloud-monitoring Spec Delta

## ADDED Requirements

### Requirement: Cloud Run Service Monitoring

The system SHALL monitor Cloud Run service health, performance, and resource utilization with automated alerting.

#### Scenario: Error rate alerting

- **GIVEN** the Cloud Run service is handling requests
- **WHEN** 4xx error rate exceeds 10% over 1 minute
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io within 2 minutes
- **AND** SHALL include error details (timestamp, error count, total requests)
- **AND** SHALL auto-close alert when error rate drops below 8%

#### Scenario: Server error alerting

- **GIVEN** the Cloud Run service is handling requests
- **WHEN** 5xx error rate exceeds 5% over 5 minutes
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io within 2 minutes
- **AND** SHALL include error details (timestamp, error count, affected endpoints)
- **AND** SHALL auto-close alert when error rate drops below 3%

#### Scenario: Error count thresholds

- **GIVEN** the Cloud Run service is handling requests
- **WHEN** 4xx errors exceed 20 per minute
- **THEN** the system SHALL trigger an alert for absolute error count
- **AND** SHALL deliver alert even if percentage threshold not met
- **WHEN** 5xx errors exceed 50 per 5 minutes
- **THEN** the system SHALL trigger a critical alert
- **AND** SHALL escalate to on-call team

#### Scenario: Memory utilization alerting

- **GIVEN** the Cloud Run service is running
- **WHEN** memory utilization exceeds 90% for 5 minutes
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include memory usage metrics and instance details
- **AND** SHALL suggest scaling or memory limit increase

#### Scenario: Instance time monitoring

- **GIVEN** the Cloud Run service is running
- **WHEN** billable instance time exceeds 60 minutes in 15-minute window
- **THEN** the system SHALL trigger a cost alert
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include scaling information and request patterns
- **AND** SHALL enable cost optimization analysis

### Requirement: Cloud SQL Database Monitoring

The system SHALL monitor Cloud SQL database resources, connections, and performance with automated alerting.

#### Scenario: Connection count alerting

- **GIVEN** the Cloud SQL database is accepting connections
- **WHEN** active connections exceed 80 (80% of max 100)
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io within 2 minutes
- **AND** SHALL include connection details (active, idle, waiting)
- **AND** SHALL suggest connection pool tuning or scaling

#### Scenario: CPU utilization alerting

- **GIVEN** the Cloud SQL database is running
- **WHEN** CPU utilization exceeds 80% for 5 minutes
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include query performance metrics
- **AND** SHALL suggest optimization or vertical scaling

#### Scenario: Memory utilization alerting

- **GIVEN** the Cloud SQL database is running
- **WHEN** memory utilization exceeds 85% for 5 minutes
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include memory usage breakdown
- **AND** SHALL auto-close when utilization drops below 75%

#### Scenario: Disk utilization alerting

- **GIVEN** the Cloud SQL database is running
- **WHEN** disk utilization exceeds 85%
- **THEN** the system SHALL trigger an alert before auto-resize
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include disk usage trends and growth rate
- **AND** SHALL provide capacity planning recommendations

### Requirement: Cron Job Execution Monitoring

The system SHALL monitor Cloud Scheduler job executions with automated alerting for failures.

#### Scenario: Cron job failure alerting

- **GIVEN** a Cloud Scheduler job is configured
- **WHEN** job execution fails
- **THEN** the system SHALL trigger an alert
- **AND** SHALL deliver alert to support@aviat.io within 2 minutes
- **AND** SHALL include job name, timestamp, error message
- **AND** SHALL track consecutive failure count

#### Scenario: Execution rate monitoring

- **GIVEN** Cloud Scheduler jobs are running
- **WHEN** job execution failure rate is calculated
- **THEN** the system SHALL compare successful vs failed executions
- **AND** SHALL alert if failure rate exceeds 10% over 1 hour
- **AND** SHALL include execution history and patterns
- **AND** SHALL auto-close when failure rate drops below 5%

#### Scenario: Critical cron job monitoring

- **GIVEN** critical cron jobs (reminders, secret checks, GDPR exports, deletions, downgrades) are configured
- **WHEN** any critical job fails
- **THEN** the system SHALL trigger a high-priority alert
- **AND** SHALL deliver alert to support@aviat.io within 1 minute
- **AND** SHALL include impact assessment (affected secrets, users)
- **AND** SHALL suggest remediation steps

### Requirement: Log-Based Error Monitoring

The system SHALL monitor application logs for errors and security events with automated alerting.

#### Scenario: Application error log monitoring

- **GIVEN** the Cloud Run service is writing logs
- **WHEN** ERROR severity logs are detected
- **THEN** the system SHALL count errors over 15-minute window
- **AND** SHALL alert if error count exceeds 20
- **AND** SHALL deliver alert to support@aviat.io
- **AND** SHALL include log samples and error patterns

#### Scenario: Security event log monitoring

- **GIVEN** the application is processing authentication attempts
- **WHEN** failed authentication attempts exceed 50 in 5 minutes
- **THEN** the system SHALL trigger a security alert
- **AND** SHALL deliver alert to support@aviat.io immediately
- **AND** SHALL include source IPs, user patterns, attack indicators
- **AND** SHALL enable incident response investigation

#### Scenario: Log-based alert thresholds

- **GIVEN** log-based alerts are configured
- **WHEN** defining alert conditions
- **THEN** the system SHALL use rate-based thresholds (count per time window)
- **AND** SHALL support 15-minute evaluation windows
- **AND** SHALL allow threshold tuning per environment
- **AND** SHALL auto-close when error rate drops below threshold

### Requirement: Uptime Health Check Monitoring

The system SHALL perform periodic health checks and alert on service unavailability.

#### Scenario: HTTP health check execution

- **GIVEN** the Cloud Run service is deployed
- **WHEN** uptime monitoring performs health checks
- **THEN** the system SHALL check /api/health/ready endpoint every 60 seconds
- **AND** SHALL expect HTTP 200 response
- **AND** SHALL validate response content contains "ok" or "healthy"
- **AND** SHALL timeout after 10 seconds

#### Scenario: Health check failure alerting

- **GIVEN** uptime monitoring is performing health checks
- **WHEN** health check fails 3 consecutive times (180 seconds)
- **THEN** the system SHALL trigger a critical availability alert
- **AND** SHALL deliver alert to support@aviat.io immediately
- **AND** SHALL include failure details (status code, response time, error message)
- **AND** SHALL continue checking until service recovers

#### Scenario: Health check recovery

- **GIVEN** a health check failure alert has been triggered
- **WHEN** health check succeeds
- **THEN** the system SHALL auto-close the alert
- **AND** SHALL calculate downtime duration
- **AND** SHALL send recovery notification to support@aviat.io
- **AND** SHALL log incident timeline for post-mortem

### Requirement: Monitoring Dashboards

The system SHALL provide pre-configured dashboards for operations and database monitoring.

#### Scenario: Operations dashboard

- **GIVEN** monitoring is configured
- **WHEN** viewing the operations dashboard
- **THEN** the system SHALL display Cloud Run request rates
- **AND** SHALL display error rates (4xx, 5xx) over time
- **AND** SHALL display response time percentiles (p50, p95, p99)
- **AND** SHALL display instance count and scaling events
- **AND** SHALL use 30-day rolling window for trends

#### Scenario: Database dashboard

- **GIVEN** monitoring is configured
- **WHEN** viewing the database dashboard
- **THEN** the system SHALL display Cloud SQL CPU utilization over time
- **AND** SHALL display memory utilization over time
- **AND** SHALL display active connection count
- **AND** SHALL display disk usage and growth rate
- **AND** SHALL use 30-day rolling window for capacity planning

#### Scenario: Dashboard widget configuration

- **GIVEN** dashboards are being created
- **WHEN** configuring dashboard widgets
- **THEN** the system SHALL use Google Cloud Monitoring metrics as data source
- **AND** SHALL support line charts, stacked area charts, and gauges
- **AND** SHALL enable drill-down to detailed metrics
- **AND** SHALL support export for reporting
