# Implementation Tasks

## Phase 1: Infrastructure Setup (Week 1)

### Task 1.1: Create alerts.tf and Notification Channel
**Deliverable**: Email notification channel configured and verified

**Steps**:
1. Create `infrastructure/apps/alerts.tf` file
2. Define `enable_alerting` variable in `variables.tf` (type: bool, default: false)
3. Create Google Cloud Monitoring notification channel resource for support@aviat.io
4. Add count/conditional logic based on enable_alerting variable
5. Verify email address through GCP console

**Validation**:
- `terraform validate` passes
- `terraform plan` shows notification channel creation
- Email verification complete in GCP console

**Dependencies**: None

---

### Task 1.2: Implement Cloud Run Error Rate Alerts
**Deliverable**: 4xx and 5xx error rate alerts operational

**Steps**:
1. Create alert policy for 4xx error rate (>10% over 1 minute)
2. Create alert policy for 5xx error rate (>5% over 5 minutes)
3. Configure conditions using `metric.type = "run.googleapis.com/request_count"` with status_code filter
4. Attach notification channel when enable_alerting = true
5. Set auto-close conditions (4xx < 8%, 5xx < 3%)

**Validation**:
- `terraform plan` shows two alert policies
- Deploy to dev with enable_alerting = false, verify alerts created without notifications
- Generate test 4xx/5xx errors, verify alert triggers (if enabled)

**Dependencies**: Task 1.1

---

### Task 1.3: Implement Cloud Run Error Count Alerts
**Deliverable**: Absolute error count alerts operational

**Steps**:
1. Create alert policy for 4xx error count (>20 per minute)
2. Create alert policy for 5xx error count (>50 per 5 minutes)
3. Use COUNT aggregation instead of RATE
4. Attach notification channel when enable_alerting = true
5. Configure alert documentation in policy description

**Validation**:
- `terraform plan` shows two additional alert policies
- Deploy to staging with enable_alerting = true
- Send 25 4xx errors within 1 minute, verify alert triggers
- Verify alert email received at support@aviat.io

**Dependencies**: Task 1.2

---

### Task 1.4: Implement Cloud Run Memory and Instance Alerts
**Deliverable**: Resource utilization alerts operational

**Steps**:
1. Create alert for memory utilization (>90% for 5 minutes)
   - Metric: `run.googleapis.com/container/memory/utilizations`
2. Create alert for instance time (>60 minutes in 15-minute window)
   - Metric: `run.googleapis.com/container/billable_instance_time`
3. Configure 5-minute evaluation window for memory
4. Configure 15-minute evaluation window for instance time
5. Attach notification channels

**Validation**:
- `terraform plan` shows two alerts
- Memory stress test triggers memory alert
- High-traffic test triggers instance time alert
- Alerts auto-close when conditions clear

**Dependencies**: Task 1.3

---

### Task 1.5: Implement Cloud SQL Resource Alerts
**Deliverable**: Database resource monitoring operational

**Steps**:
1. Create alert for connection count (>80 of max 100)
   - Metric: `cloudsql.googleapis.com/database/postgresql/num_backends`
2. Create alert for CPU utilization (>80% for 5 minutes)
   - Metric: `cloudsql.googleapis.com/database/cpu/utilization`
3. Create alert for memory utilization (>85% for 5 minutes)
   - Metric: `cloudsql.googleapis.com/database/memory/utilization`
4. Create alert for disk utilization (>85%)
   - Metric: `cloudsql.googleapis.com/database/disk/utilization`
5. Attach notification channels

**Validation**:
- `terraform plan` shows four Cloud SQL alerts
- Connection stress test triggers connection alert
- CPU stress test (heavy queries) triggers CPU alert
- Verify all alerts reference correct Cloud SQL instance

**Dependencies**: Task 1.1

**Parallel**: Can be done in parallel with Tasks 1.2-1.4

---

### Task 1.6: Deploy to Staging Environment
**Deliverable**: All Phase 1 alerts operational in staging

**Steps**:
1. Update `infrastructure/terragrunt/staging/terraform.tfvars`:
   ```hcl
   enable_alerting = true
   ```
2. Run `terragrunt plan` to verify all resources
3. Run `terragrunt apply` to deploy alerts
4. Verify all alerts visible in GCP Monitoring console
5. Verify notification channel shows support@aviat.io

**Validation**:
- All alert policies created successfully
- No Terraform errors or warnings
- GCP Monitoring dashboard shows all alerts
- Email verification complete

**Dependencies**: Tasks 1.1-1.5

---

## Phase 2: Extended Monitoring (Week 2)

### Task 2.1: Implement Cron Job Monitoring
**Deliverable**: Cloud Scheduler execution monitoring operational

**Steps**:
1. Create alert for cron job failures (any failure)
   - Metric: `scheduler.googleapis.com/job/execution/failure_count`
   - Condition: COUNT > 0 in 5-minute window
2. Create alert for execution rate (failure rate >10% over 1 hour)
   - Use RATE of failures vs successes
3. Create high-priority variants for critical jobs:
   - process-reminders (15-min frequency in prod)
   - check-secrets (15-min frequency in prod)
   - process-exports (10-min frequency in prod)
   - cleanup-exports (daily at 3 AM)
   - process-deletions (daily at 4 AM)
4. Attach notification channels

**Validation**:
- `terraform plan` shows cron monitoring alerts
- Manually trigger job failure (invalid cron_secret), verify alert
- Multiple failures trigger execution rate alert
- Critical job failures trigger within 1 minute

**Dependencies**: Task 1.6

---

### Task 2.2: Implement Log-Based Error Monitoring
**Deliverable**: Application error log monitoring operational

**Steps**:
1. Create log-based metric for ERROR severity logs
   - Filter: `severity="ERROR" AND resource.type="cloud_run_revision"`
2. Create alert for error log count (>20 in 15 minutes)
3. Create log-based metric for security events
   - Filter: `jsonPayload.message=~"authentication failed|invalid credentials"`
4. Create alert for security events (>50 in 5 minutes)
5. Configure log sampling to control costs

**Validation**:
- `terraform plan` shows log-based metrics and alerts
- Generate ERROR logs, verify metric increments
- Generate failed auth attempts, verify security alert
- Log-based alerts visible in GCP Monitoring

**Dependencies**: Task 1.6

**Parallel**: Can be done in parallel with Task 2.1

---

### Task 2.3: Implement Uptime Monitoring
**Deliverable**: Health check monitoring operational

**Steps**:
1. Create uptime check resource for `/api/health/ready` endpoint
   - Check interval: 60 seconds
   - Timeout: 10 seconds
   - Expected status: 200
   - Content match: "ok" or "healthy"
2. Create alert for uptime check failures (3 consecutive failures)
3. Configure alert to trigger within 180 seconds (3 × 60s)
4. Set CRITICAL severity for availability alerts
5. Attach notification channel

**Validation**:
- `terraform plan` shows uptime check and alert
- Uptime check visible in GCP Monitoring Uptime Checks
- Stop Cloud Run service temporarily, verify alert triggers
- Service recovery triggers auto-close notification

**Dependencies**: Task 1.6

**Parallel**: Can be done in parallel with Tasks 2.1-2.2

---

### Task 2.4: Deploy Extended Monitoring to Staging
**Deliverable**: All Phase 2 alerts operational in staging

**Steps**:
1. Run `terragrunt plan` in staging to verify Phase 2 changes
2. Run `terragrunt apply` to deploy
3. Verify all new alerts visible in GCP Monitoring
4. Test each alert type:
   - Trigger cron job failure
   - Generate error logs
   - Simulate downtime for uptime check
5. Verify alert delivery to support@aviat.io

**Validation**:
- All alerts created successfully
- Alert delivery confirmed for each type
- Alert auto-close verified
- No false positives during 24-hour monitoring

**Dependencies**: Tasks 2.1-2.3

---

## Phase 3: Dashboards and Production (Week 3)

### Task 3.1: Create Operations Dashboard
**Deliverable**: Cloud Run operations dashboard operational

**Steps**:
1. Create Google Cloud Monitoring dashboard resource
2. Add widgets for:
   - Request rate (requests/second) - line chart
   - Error rates (4xx, 5xx) over time - stacked area chart
   - Response time percentiles (p50, p95, p99) - line chart
   - Active instance count - line chart
   - Memory utilization - gauge + line chart
3. Configure 30-day time window for all widgets
4. Add dashboard title: "KeyFate Frontend Operations Dashboard - {env}"
5. Organize widgets in logical layout (top: critical metrics, bottom: detailed)

**Validation**:
- `terraform plan` shows dashboard resource
- Dashboard visible in GCP Monitoring Dashboards
- All widgets display data correctly
- Dashboard accessible to team members with GCP project access

**Dependencies**: Task 1.6

---

### Task 3.2: Create Database Dashboard
**Deliverable**: Cloud SQL database dashboard operational

**Steps**:
1. Create Google Cloud Monitoring dashboard resource
2. Add widgets for:
   - CPU utilization over time - line chart
   - Memory utilization over time - line chart
   - Active connection count - line chart
   - Disk usage and growth rate - line chart with trend
   - Query execution time (if available) - line chart
3. Configure 30-day time window for trend analysis
4. Add dashboard title: "KeyFate Database Dashboard - {env}"
5. Add capacity planning annotations (thresholds, scaling points)

**Validation**:
- `terraform plan` shows dashboard resource
- Dashboard visible in GCP Monitoring Dashboards
- All widgets display database metrics correctly
- Trend lines useful for capacity planning

**Dependencies**: Task 1.6

**Parallel**: Can be done in parallel with Task 3.1

---

### Task 3.3: Tune Alert Thresholds Based on Production Data
**Deliverable**: Alert thresholds optimized for production traffic patterns

**Steps**:
1. Deploy to production with enable_alerting = true
2. Monitor alert frequency for 48 hours
3. Analyze false positives:
   - Document alert name, timestamp, duration
   - Identify root cause (legitimate spike vs bad threshold)
4. Adjust thresholds in alerts.tf if >3 false positives in 48 hours:
   - Increase threshold by 20-50%
   - Document rationale in Git commit message
   - Redeploy and monitor for another 48 hours
5. Document baseline metrics for future reference

**Validation**:
- Zero false positives during 48-hour validation period
- All legitimate issues trigger alerts
- Alert thresholds documented in alerts.tf comments
- Baseline metrics documented in runbook

**Dependencies**: Tasks 3.1-3.2, Production deployment

---

### Task 3.4: Create Alert Runbooks
**Deliverable**: Documentation for common alerts and remediation

**Steps**:
1. Create `docs/runbooks/cloud-monitoring.md` with:
   - Alert name and description
   - Common causes
   - Investigation steps
   - Remediation procedures
   - Escalation criteria
2. Document runbooks for:
   - High error rate alerts (4xx, 5xx)
   - Resource exhaustion alerts (memory, CPU, connections, disk)
   - Cron job failure alerts
   - Uptime check failures
   - Security event alerts
3. Link dashboards and log queries for investigation
4. Define expected response times by severity

**Validation**:
- Runbook covers all alert types
- Investigation steps are actionable
- Remediation procedures tested in staging
- Team reviews and approves runbook content

**Dependencies**: Tasks 2.4, 3.1-3.2

**Parallel**: Can be written in parallel with threshold tuning

---

### Task 3.5: Deploy to Production
**Deliverable**: All monitoring operational in production

**Steps**:
1. Update `infrastructure/terragrunt/prod/terraform.tfvars`:
   ```hcl
   enable_alerting = true
   ```
2. Run `terragrunt plan` to verify all resources
3. Review plan output for correctness
4. Run `terragrunt apply` to deploy
5. Verify all alerts and dashboards created
6. Send test alert (synthetic failure) to verify delivery
7. Monitor for 48 hours for false positives

**Validation**:
- All resources created successfully in production
- Alerts delivered to support@aviat.io
- Dashboards accessible and displaying production metrics
- No false positives during 48-hour validation
- Team trained on alert response procedures

**Dependencies**: Tasks 3.3-3.4

---

### Task 3.6: Enable Monitoring for Remaining Environments
**Deliverable**: Monitoring operational in all environments

**Steps**:
1. Dev environment (keep enable_alerting = false by default):
   - Verify alert policies exist but notifications disabled
   - Document how to enable for testing
2. Staging environment (already enabled in Task 2.4):
   - Verify all Phase 3 dashboards deployed
   - Keep enable_alerting = true for ongoing testing
3. Production environment (enabled in Task 3.5):
   - Monitor for first week of operation
   - Document any threshold adjustments needed

**Validation**:
- All environments have consistent alert definitions
- Dev has alerts disabled for quiet development
- Staging and prod have alerts enabled and operational
- Documentation updated with environment-specific settings

**Dependencies**: Task 3.5

---

## Validation and Sign-off

### Final Validation Checklist

**Infrastructure**:
- [ ] All resources in alerts.tf follow naming conventions
- [ ] enable_alerting variable works correctly in all environments
- [ ] Terraform state clean with no drift

**Alerts**:
- [ ] All 15+ alert policies created and operational
- [ ] Alert delivery confirmed for each type
- [ ] Alert auto-close verified
- [ ] No false positives during 48-hour production validation

**Dashboards**:
- [ ] Operations dashboard displays all critical metrics
- [ ] Database dashboard displays all resource metrics
- [ ] Dashboards accessible to team members
- [ ] 30-day retention working correctly

**Documentation**:
- [ ] Alert runbooks complete and tested
- [ ] Threshold rationale documented
- [ ] Team trained on alert response
- [ ] Environment-specific configurations documented

**Cost**:
- [ ] Monitoring costs tracked in GCP billing
- [ ] Costs under $50/month target
- [ ] No unexpected cost spikes

**Success Criteria Met**:
- [ ] All alerts deliver to support@aviat.io successfully
- [ ] No false positives during 48-hour validation
- [ ] Dashboards render correctly with real metrics
- [ ] Alert auto-close works when conditions clear
- [ ] Zero impact on application performance
- [ ] Terraform apply completes without errors
- [ ] Monitoring costs under $50/month

---

## Rollback Plan

If critical issues arise during deployment:

1. **Disable alerts in affected environment**:
   ```hcl
   enable_alerting = false
   ```
   Run `terragrunt apply` to stop alert delivery while keeping metrics collection

2. **Revert alerts.tf changes**:
   ```bash
   git revert <commit-hash>
   terragrunt apply
   ```

3. **Remove monitoring resources entirely** (last resort):
   ```bash
   cd infrastructure/apps
   rm alerts.tf
   terragrunt apply
   ```

**Note**: Rollback does not affect existing application functionality, only observability.
