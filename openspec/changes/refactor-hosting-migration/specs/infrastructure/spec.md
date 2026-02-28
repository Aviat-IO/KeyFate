## MODIFIED Requirements

### Requirement: Hosting Platform

The system SHALL be deployed on Railway using Docker container deployment.
Railway SHALL provide managed PostgreSQL, environment variable management, and
automatic deployments from GitHub.

#### Scenario: Production deployment

- **WHEN** code is pushed to the main branch
- **THEN** Railway SHALL automatically build the Docker image and deploy the
  application
- **AND** the application SHALL be accessible via the configured custom domain

#### Scenario: Database provisioning

- **WHEN** a new environment is created on Railway
- **THEN** a managed PostgreSQL instance SHALL be provisioned
- **AND** the `DATABASE_URL` environment variable SHALL be automatically
  injected

### Requirement: Scheduled Tasks

The system SHALL execute 7 cron jobs via Railway's cron service or an in-app
scheduler. Critical jobs (check-secrets, process-reminders) SHALL run every 15
minutes. Maintenance jobs (cleanup, exports, deletions, downgrades) SHALL run
daily.

#### Scenario: Secret check-in monitoring

- **WHEN** the check-secrets cron fires every 15 minutes
- **THEN** the system SHALL identify secrets past their check-in deadline
- **AND** trigger the disclosure process for expired secrets

#### Scenario: Cron authentication

- **WHEN** a cron endpoint is invoked
- **THEN** the request SHALL include a valid HMAC token
- **AND** unauthenticated cron requests SHALL be rejected with 401

## REMOVED Requirements

### Requirement: Google Cloud Platform Infrastructure

**Reason**: GCP infrastructure (Cloud Run, Cloud SQL, Bastion, VPC, Cloud
Scheduler, Secret Manager, Artifact Registry) is being replaced by Railway to
reduce costs from $100+/month to ~$5/month.

**Migration**: All GCP resources will be torn down after Railway deployment is
verified. Terraform/Terragrunt configuration will be archived.
