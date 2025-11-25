# Cloud Monitoring Design

## Architecture Overview

The cloud monitoring infrastructure is implemented entirely in Google Cloud using native monitoring services. All configuration is managed via Terraform in a single file `infrastructure/apps/alerts.tf` for maintainability and consistency.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Google Cloud Monitoring                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
         ┌──────────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
         │ Notification    │  │  Alert   │  │ Dashboards │
         │ Channels        │  │ Policies │  │            │
         └──────────────────┘  └──────────┘  └────────────┘
                    │               │               │
         ┌──────────▼──────────────┼───────────────▼────────┐
         │                         │                         │
    ┌────▼─────┐          ┌───────▼────────┐      ┌────────▼────────┐
    │ Email to │          │ Metric-based   │      │ Operations      │
    │ support@ │          │ Alerts         │      │ Dashboard       │
    │ aviat.io │          └────────────────┘      └─────────────────┘
    └──────────┘                   │
                          ┌────────┼────────┐
                          │        │        │
                   ┌──────▼───┐ ┌─▼──────┐ ┌▼────────┐
                   │Cloud Run │ │Cloud   │ │Uptime   │
                   │Metrics   │ │SQL     │ │Checks   │
                   └──────────┘ └────────┘ └─────────┘
```

## Data Flow

### 1. Metric Collection
- Google Cloud services (Cloud Run, Cloud SQL, Cloud Scheduler) automatically emit metrics
- Metrics stored in Google Cloud Monitoring time-series database
- No application code changes required for infrastructure metrics
- Log-based metrics derived from Cloud Logging

### 2. Alert Evaluation
- Alert policies continuously evaluate metric conditions
- Evaluation windows: 1min (error rates), 5min (resources), 15min (logs)
- Conditions use aggregation: rate, threshold, absence
- Multiple conditions can be combined with AND/OR logic

### 3. Alert Notification
- Triggered alerts send notifications to configured channels
- Email channel delivers to support@aviat.io
- Notification includes:
  - Alert name, severity, timestamp
  - Metric values and threshold breach details
  - Direct links to logs, dashboards, affected resources
- Alert auto-closes when condition clears

### 4. Dashboard Visualization
- Pre-configured dashboards query metrics via MQL (Monitoring Query Language)
- Widgets display time-series charts, gauges, and tables
- 30-day retention for trend analysis and capacity planning
- Dashboards accessible via Google Cloud Console

## Technical Decisions

### Decision: Single Terraform File (alerts.tf)

**Rationale**: All monitoring resources in one file for:
- Easy maintenance (all alerts visible in single location)
- Consistent resource naming and labeling
- Simplified review process for alert changes
- Clear separation from other infrastructure concerns

**Trade-offs**:
- File may grow large (100-300 lines per alert policy)
- Could be split by component if exceeds 2000 lines
- Current scope (~15 alert policies) fits comfortably in single file

### Decision: Environment Control via enable_alerting Variable

**Rationale**:
- Prevents alert spam during development
- Enables alert testing in staging without production impact
- Same alert definitions across all environments (consistency)
- Simple boolean flag for clear intent

**Alternative Considered**: Environment-specific thresholds
- Rejected: Adds complexity, reduces consistency
- Different thresholds make staging less representative of production
- Alert tuning should use production data, not synthetic staging data

### Decision: Email-Only Notifications (MVP)

**Rationale**:
- Email is universal, no additional service setup required
- support@aviat.io already monitored by team
- Sufficient for current scale and response time requirements
- Can add Slack/PagerDuty later without architectural changes

**Alternative Considered**: Multi-channel from start
- Rejected: Added complexity for unclear benefit
- Email proven sufficient for similar-scale applications
- Can add channels incrementally based on actual needs

### Decision: Tight Alert Thresholds

**Rationale**:
- Sensitive application requires high reliability
- Better to over-alert initially and tune down
- Establishes baseline expectations for service health
- False positives preferable to missed incidents

**Alternative Considered**: Conservative thresholds
- Rejected: May miss real issues
- Can lead to degraded service without awareness
- Tuning up is harder than tuning down (requires incident to justify)

### Decision: Native Google Cloud Monitoring

**Rationale**:
- Zero additional infrastructure to manage
- No extra API keys or authentication to secure
- Native integration with GCP services
- Cost-effective at current scale ($10-50/month)

**Alternatives Considered**:
- **Datadog/New Relic**: $70-150/month, overkill for infrastructure monitoring
- **Prometheus/Grafana**: Requires hosting, maintenance burden
- **CloudWatch Logs Insights**: Not applicable (GCP, not AWS)

### Decision: 30-Day Dashboard Retention

**Rationale**:
- GCP default, no additional cost
- Sufficient for most debugging scenarios
- Capacity planning typically uses 14-30 day trends
- Longer retention (90+ days) requires BigQuery export ($$$)

**Alternative Considered**: 90-day retention
- Rejected: Significant cost increase for marginal benefit
- Historical analysis can use backup/snapshot data if needed
- 30 days covers most incident timeframes

## Metric Selection Rationale

### Cloud Run Metrics
- **Error rates (4xx, 5xx)**: Direct indicator of service health
- **Error counts**: Absolute thresholds catch issues at low traffic
- **Memory utilization**: Prevents OOM crashes
- **Instance time**: Cost control and scaling indicator

**Not Monitoring** (yet):
- Request latency: Sentry handles APM, would duplicate
- Startup latency: Not critical for current traffic patterns
- Container resource usage: Memory covers most issues

### Cloud SQL Metrics
- **Connection count**: Prevents pool exhaustion
- **CPU utilization**: Query performance indicator
- **Memory utilization**: Cache effectiveness
- **Disk utilization**: Capacity planning

**Not Monitoring** (yet):
- Query performance: Complex, requires APM integration
- Replication lag: Not using read replicas currently
- Backup status: Covered by infrastructure spec separately

### Cron Job Metrics
- **Execution failures**: Direct indicator of job health
- **Execution rate**: Trend analysis for persistent issues

**Not Monitoring** (yet):
- Execution duration: Would require custom metrics
- Rate limit hits: No rate limiting on cron endpoints currently

## Integration Points

### With Existing Infrastructure
- References `module.cloud_run.service_name` for Cloud Run service ID
- References `module.cloudsql_instance.connection_name` for database ID
- References `google_cloud_scheduler_job.*` for cron job IDs
- Uses `module.project.id` for resource scoping
- Uses `var.env` for environment-specific configuration

### With Existing Monitoring Spec
- Complements application-level monitoring (Sentry, logging)
- Infrastructure metrics (this change) vs application metrics (existing)
- Both systems necessary for comprehensive observability
- No overlap or duplication of concerns

### With Future Enhancements
- Custom metrics: Can add application-instrumented metrics to same dashboard
- SLO/SLI: Can define SLOs based on metrics collected here
- Incident management: Can integrate with PagerDuty/Opsgenie later
- Cost analysis: Can add cost dashboards using same architecture

## Resource Naming Conventions

All resources follow consistent naming pattern:

```
Alert Policies:    keyfate-[service]-[metric]-[condition]-[env]
Notification:      keyfate-support-email-[env]
Dashboards:        KeyFate [Service] [Type] Dashboard - [env]
Uptime Checks:     keyfate-[service]-health-[env]
```

**Example**:
- Alert: `keyfate-frontend-error-rate-high-prod`
- Notification: `keyfate-support-email-prod`
- Dashboard: `KeyFate Frontend Operations Dashboard - prod`
- Uptime: `keyfate-frontend-health-prod`

## Cost Estimation

Based on GCP Monitoring pricing:

- **Metrics ingestion**: ~50GB/month @ $0.258/GB = $13/month
- **API calls**: ~500K/month (dashboards) @ $0.01/1K = $5/month
- **Log ingestion**: ~10GB/month @ $0.50/GB = $5/month
- **Uptime checks**: 6 checks @ $0.30/check = $1.80/month
- **Alerting**: Included in metrics cost

**Total**: ~$25-35/month per environment
**Production only**: ~$30/month (staging alerts disabled most of time)

**Note**: Within $50/month target, significant room for growth.

## Testing Strategy

### Staging Validation
1. Deploy alerts.tf with enable_alerting = true
2. Generate synthetic traffic and errors using test scripts
3. Verify alert delivery to support@aviat.io within expected timeframes
4. Confirm alert auto-close when conditions clear
5. Validate dashboard rendering and metric accuracy

### Production Rollout
1. Deploy with enable_alerting = true
2. Monitor for false positives during first 48 hours
3. Tune thresholds based on actual production traffic patterns
4. Document baseline metrics for future reference
5. Validate alert delivery for real incidents

### Ongoing Validation
- Monthly test of critical alert paths (synthetic failure injection)
- Quarterly review of alert effectiveness and false positive rate
- Annual review of threshold appropriateness based on service evolution

## Security Considerations

### Sensitive Data
- Alert notifications include metric values but not user data
- Log-based alerts use sanitized logs (per monitoring spec)
- Email delivery to support@aviat.io uses TLS

### Access Control
- Monitoring dashboards require GCP IAM authentication
- Alert policies managed via Terraform (code review required)
- Notification channels require email verification
- No public access to monitoring data

### Compliance
- 30-day retention aligns with operational needs, not long-term audit requirements
- Security events logged separately per monitoring spec
- Alert data stored in GCP region (complies with data residency if applicable)

## Failure Modes and Mitigations

### Alert Delivery Failure
- **Cause**: Email service outage, invalid email address
- **Detection**: Google Cloud Monitoring logs delivery failures
- **Mitigation**: 3 automatic retries, manual verification of email address
- **Recovery**: Add secondary notification channel (Slack) if email unreliable

### False Positives
- **Cause**: Overly tight thresholds, traffic pattern changes
- **Detection**: High alert frequency, alerts with short duration
- **Mitigation**: 48-hour tuning period, documented threshold adjustment process
- **Recovery**: Adjust thresholds based on production baseline, document rationale

### Monitoring Service Outage
- **Cause**: Google Cloud Monitoring service disruption
- **Detection**: No alerts received during known issues
- **Mitigation**: Rely on Sentry APM and health checks as backup
- **Recovery**: GCP SLA covers monitoring service, no action required

### Metric Collection Lag
- **Cause**: Metric ingestion delay during high load
- **Detection**: Stale dashboard data, alert delay
- **Mitigation**: Use appropriate evaluation windows (5-15min) to tolerate lag
- **Recovery**: GCP handles metric ingestion, no customer action required

### Cost Overruns
- **Cause**: Excessive metric cardinality, log volume spike
- **Detection**: GCP billing alerts (separate from this change)
- **Mitigation**: Monitoring cost included in budget, sampling if needed
- **Recovery**: Reduce sampling, adjust log filters, optimize queries

## Future Enhancements (Non-Goals)

These are explicitly **not** included in this change but may be considered later:

1. **Custom Application Metrics**: Instrumentation in application code to emit business metrics
2. **SLO/SLI Definitions**: Service level objectives and indicators based on baseline data
3. **Multi-Channel Notifications**: Slack, Discord, PagerDuty integration
4. **Advanced Dashboards**: Custom dashboard builders, team-specific views
5. **Anomaly Detection**: ML-based anomaly detection for metric patterns
6. **Cross-Region Monitoring**: Multi-region deployment monitoring
7. **Synthetic Monitoring**: Proactive transaction testing beyond health checks
8. **Trace Integration**: Distributed tracing correlation with metrics

Each of these would require a separate change proposal with its own design considerations.
