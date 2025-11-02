# Add Cloud Monitoring

## Overview

Implement comprehensive Google Cloud Monitoring and Alerting for KeyFate
production infrastructure. This ensures full visibility into system health,
performance, and errors across Cloud Run services, Cloud SQL database, and Cloud
Scheduler cron jobs. All alerts will be delivered to support@aviat.io for
immediate incident response.

## Problem Statement

Currently, KeyFate lacks production-grade monitoring and alerting
infrastructure:

- **No visibility** into Cloud Run service health (error rates, response times,
  instance scaling)
- **No database monitoring** for Cloud SQL (CPU, memory, connections, disk
  usage)
- **No cron job monitoring** for critical scheduled tasks (reminders, secret
  checks, GDPR exports)
- **No alerting** when critical thresholds are breached
- **Manual incident detection** relies on users reporting issues rather than
  proactive monitoring
- **No performance baselines** to identify degradation over time

This creates significant operational risk:

- Critical failures may go undetected until user complaints
- Performance degradation can accumulate without warning
- Database resource exhaustion could cause sudden outages
- Cron job failures could violate SLAs for secret disclosure timing

## Proposed Solution

Implement a comprehensive Google Cloud Monitoring suite managed via Terraform:

### 1. **Notification Channels**

- Email channel to support@aviat.io
- Configurable via `enable_alerting` variable (disabled in dev, enabled in
  staging/prod)

### 2. **Cloud Run Service Monitoring**

- **Error Rate Alerts**: 4xx (>10% in 1min) and 5xx (>5% in 5min) error rates
- **Error Count Alerts**: Absolute error thresholds (>20 4xx/min, >50 5xx/5min)
- **Instance Time Alert**: High billable instance time (>60min in 15min window)
- **Memory Usage Alert**: Memory utilization >90% for 5 minutes

### 3. **Cloud SQL Database Monitoring**

- **Connection Count Alert**: >80% of max connections (100)
- **CPU Utilization Alert**: >80% for 5 minutes
- **Memory Utilization Alert**: >85% for 5 minutes
- **Disk Utilization Alert**: >85% (triggers before auto-resize)

### 4. **Cron Job Monitoring**

- **Cloud Scheduler Execution Failures**: Failed job executions
- **Execution Rate Monitoring**: Track successful vs failed execution rates
- Alert on consecutive failures or sustained error rates

### 5. **Log-Based Error Monitoring**

- **Application Error Logs**: ERROR severity logs from Cloud Run
- **Security Event Logs**: Failed authentication attempts >50/5min
- Rate-based thresholds with 15-minute evaluation windows

### 6. **Uptime Monitoring**

- **Frontend Health Checks**: HTTP checks to Cloud Run service endpoints
- 60-second check intervals with 180-second failure threshold
- Content validation for health check responses

### 7. **Monitoring Dashboards**

- **Operations Dashboard**: Request rates, error rates, response times
- **Database Dashboard**: CPU, memory, connections, disk utilization
- Pre-configured widgets for key metrics
- 30-day rolling windows for trend analysis

## Architecture

All monitoring infrastructure will be defined in
`infrastructure/apps/alerts.tf`:

```
alerts.tf
├── Notification Channels (email to support@aviat.io)
├── Alert Policies
│   ├── Cloud Run (errors, performance, scaling)
│   ├── Cloud SQL (resources, connections)
│   ├── Cron Jobs (failures, execution rates)
│   ├── Logs (errors, security events)
│   └── Uptime (health checks)
└── Dashboards
    ├── Operations Dashboard
    └── Database Dashboard
```

### Integration with Existing Infrastructure

- Uses existing `var.env` to differentiate dev/staging/prod
- Uses existing `module.project.id` for resource scoping
- References existing resources:
  - `module.cloud_run` (frontend service)
  - `module.cloudsql_instance` (database)
  - `google_cloud_scheduler_job.*` (cron jobs)
- Controlled by new variable `var.enable_alerting` (default: false)

### Terragrunt Configuration

Add to each environment's `terraform.tfvars`:

```hcl
# Dev environment - disable alerting (noisy during development)
enable_alerting = false

# Staging environment - enable to test alerts
enable_alerting = true

# Production environment - enable for full monitoring
enable_alerting = true
```

## Benefits

### Operational Excellence

- **Proactive incident detection** via automated alerts
- **Reduced MTTR** (Mean Time To Recovery) through immediate notification
- **Baseline establishment** for performance and error rates
- **Capacity planning** data from resource utilization trends

### Risk Mitigation

- **Database exhaustion prevention** via connection/resource alerts
- **Cron job failure detection** ensuring SLA compliance
- **Security monitoring** via authentication failure tracking
- **Cost management** via instance time and scaling alerts

### Developer Experience

- **Clear visibility** into production behavior
- **Historical data** for debugging incidents
- **Performance trends** for optimization opportunities
- **Consolidated dashboards** reducing context switching

## Implementation Notes

### Phase 1: Core Alerts (Week 1)

1. Create `alerts.tf` with notification channels
2. Implement Cloud Run error rate alerts
3. Implement Cloud SQL resource alerts
4. Deploy to staging for validation

### Phase 2: Extended Monitoring (Week 2)

1. Add cron job execution monitoring
2. Add log-based error alerting
3. Add uptime checks
4. Deploy to production

### Phase 3: Dashboards & Tuning (Week 3)

1. Create monitoring dashboards
2. Tune alert thresholds based on real traffic
3. Document runbooks for common alerts
4. Enable for production

### Testing Strategy

- Deploy to dev with `enable_alerting = true` temporarily
- Generate test traffic and errors
- Validate alert delivery to support@aviat.io
- Confirm alert auto-close behavior
- Test dashboard functionality

## Non-Goals

- **Application-level tracing** (Sentry/OpenTelemetry) - separate concern
- **Custom metrics** from application code - future enhancement
- **SLO/SLI definitions** - requires production data baseline first
- **PagerDuty integration** - email notification sufficient for MVP
- **Google Chat notifications** - not using Google Workspace currently

## Dependencies

- Existing Terraform infrastructure in `infrastructure/apps/`
- Existing Terragrunt configuration in
  `infrastructure/terragrunt/{dev,staging,prod}/`
- Google Cloud Monitoring API enabled (should already be enabled)
- Access to support@aviat.io email for alert delivery

## Risks & Mitigations

| Risk                                | Impact                       | Mitigation                                     |
| ----------------------------------- | ---------------------------- | ---------------------------------------------- |
| Alert fatigue from noisy thresholds | Team ignores critical alerts | Start conservative, tune based on real traffic |
| Missing critical metrics            | Blind spots in monitoring    | Incremental rollout allows adding metrics      |
| Cost of monitoring                  | Increased GCP bill           | Use sampling, disable in dev, monitor costs    |
| False positives in staging          | Unnecessary alerts           | Separate thresholds per environment            |

## Success Criteria

- ✅ All alerts successfully deliver to support@aviat.io
- ✅ No false positives during 48-hour validation period
- ✅ Dashboards render correctly with real metrics
- ✅ Alert auto-close works when conditions clear
- ✅ Zero impact on application performance
- ✅ Terraform apply completes without errors
- ✅ Monitoring costs <$50/month

## Related Specifications

- `infrastructure` - Existing infrastructure spec
- `monitoring` - Application-level monitoring (Sentry, logging)
- `api-security` - Security monitoring and audit logging

## Open Questions

1. **Threshold tuning**: Should we start with conservative thresholds and
   tighten, or aggressive and loosen?
   - **Recommendation**: Conservative first (reduce false positives), tune based
     on production data
2. **Multi-channel notifications**: Should we support Slack/Discord in addition
   to email?
   - **Recommendation**: Start with email only, add additional channels as
     requested
3. **Custom metrics**: Should we instrument application code to send custom
   business metrics?
   - **Recommendation**: Defer to future change proposal, focus on
     infrastructure metrics first
4. **Retention period**: How long should we retain dashboard data?
   - **Recommendation**: Use GCP defaults (30 days), sufficient for most
     debugging

5. **Environment-specific thresholds**: Should dev/staging/prod have different
   alert thresholds?
   - **Recommendation**: Same thresholds, but use `enable_alerting` to disable
     in dev entirely
