# Email Cron Implementation - PRD

## Overview

Implement email functionality for cron job endpoints (`process-reminders` and `check-secrets`) with a modular, provider-agnostic email library.

## Requirements

### Email Provider Abstraction

- Generic `EmailProvider` interface with `sendEmail()` method
- `SendGridAdapter` using existing SendGrid infrastructure at `/frontend/src/lib/email/email-service.ts`
- `MockAdapter` for testing and development
- Factory pattern for provider selection via `EMAIL_PROVIDER` env var
- Support for provider configuration and features

### Email Library Infrastructure

- Leverage existing `/frontend/src/lib/email/templates.ts` (reminder and disclosure templates)
- Leverage existing `/frontend/src/lib/email/email-service.ts` (SendGrid integration)
- Create `/frontend/src/lib/email/providers/` directory structure
- Create `/frontend/src/lib/email/email-factory.ts` for provider selection
- Dependency injection principles throughout

### Process Reminders Cron (`/frontend/src/app/api/cron/process-reminders/route.ts`)

- Query database for overdue secrets (status='active', next_check_in < now)
- Decrypt server share using crypto utilities
- Send disclosure emails to recipients using `sendSecretDisclosureEmail()`
- Log email operations to database
- Handle failures with retry logic and admin notifications to <support@aviat.io>
- Update secret status to 'triggered' after successful delivery

### Check Secrets Cron (`/frontend/src/app/api/cron/check-secrets/route.ts`)

- Query database for secrets needing check-in reminders
- Calculate urgency level based on time remaining (low/medium/high/critical)
- Send reminder emails using `sendReminderEmail()` with check-in URL
- Support multiple reminder intervals (25%, 50%, 7d, 3d, 24h, 12h, 1h)
- Log reminder operations to database
- Handle failures with retry logic

### Database Failure Tracking

- Create `email_failures` table in schema
- Log all email attempts with success/failure status
- Record provider, error messages, retry counts
- Support admin dashboard queries
- Cleanup policies for old logs

### Admin Notifications

- Send alerts to <support@aviat.io> on failures
- Include error details, timestamp, affected secrets
- Support severity levels (low/medium/high/critical)
- Batch notifications to prevent spam
- Use existing admin alert functionality from `/frontend/src/lib/services/email-service.ts`

### Testing Strategy

- Unit tests for email providers (SendGrid and Mock)
- Integration tests for cron endpoints with mock provider
- E2E tests for complete email flow
- Failure scenario testing and recovery
- Test mode without API keys using mock provider

## Environment Variables

```
SENDGRID_API_KEY=xxx
SENDGRID_ADMIN_EMAIL=xxx
SENDGRID_SENDER_NAME=xxx
EMAIL_PROVIDER=sendgrid|mock
ADMIN_ALERT_EMAIL=support@aviat.io
```

## Success Criteria

- Cron endpoints send emails in production
- Provider switchable via env var
- All operations logged to database
- Failed emails trigger admin notifications
- Mock provider enables local development
- Test coverage >90%
- Zero data loss on failures (logged and retryable)
