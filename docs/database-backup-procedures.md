# Database Backup & Recovery Procedures

## Overview

KeyFate uses Google Cloud SQL (PostgreSQL) with automated daily backups. This
document outlines backup procedures, recovery targets, and restoration steps.

## Backup Configuration

### Automated Backups (Cloud SQL)

**Schedule:** Daily at 2:00 AM UTC\
**Retention:**

- Daily backups: 30 days
- Weekly backups: 90 days (first backup of each week retained)

**Location:** Same region as primary database (automated by Cloud SQL)

### Backup Targets

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours

## Cloud SQL Backup Configuration

Enable automated backups in your Cloud SQL instance:

```bash
gcloud sql instances patch keyfate-db \
  --backup-start-time=02:00 \
  --retained-backups-count=30 \
  --retained-transaction-log-days=7
```

### Verify Backup Status

```bash
# List all backups
gcloud sql backups list --instance=keyfate-db

# Check latest backup
gcloud sql backups list --instance=keyfate-db --limit=1
```

## Recovery Procedures

### Full Database Restore

#### 1. Restore to New Instance (Recommended)

```bash
# Create new instance from backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=keyfate-db \
  --restore-instance=keyfate-db-restored

# Update connection string to point to restored instance
# DATABASE_URL=postgresql://user:pass@RESTORED_IP:5432/keyfate
```

#### 2. Restore to Existing Instance

```bash
# Stop application traffic first
kubectl scale deployment keyfate-frontend --replicas=0

# Restore backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=keyfate-db

# Restart application
kubectl scale deployment keyfate-frontend --replicas=3
```

### Point-in-Time Recovery

Cloud SQL supports PITR using transaction logs (retained for 7 days):

```bash
# Restore to specific timestamp
gcloud sql instances create keyfate-db-pitr \
  --source-instance=keyfate-db \
  --point-in-time="2024-01-15T10:30:00.000Z"
```

### Testing Restore Procedures

**Monthly Testing Schedule:**

- First Monday of each month: Test backup restoration
- Verify data integrity post-restore
- Measure actual recovery time
- Document any issues or improvements

```bash
# Monthly restore test script
#!/bin/bash
BACKUP_ID=$(gcloud sql backups list --instance=keyfate-db --limit=1 --format="value(id)")
TEST_INSTANCE="keyfate-test-restore-$(date +%Y%m%d)"

echo "Testing restore of backup: $BACKUP_ID"
gcloud sql backups restore $BACKUP_ID \
  --backup-instance=keyfate-db \
  --restore-instance=$TEST_INSTANCE

echo "Verifying data integrity..."
# Connect and run validation queries
psql "postgresql://user:pass@TEST_INSTANCE_IP:5432/keyfate" -c "SELECT COUNT(*) FROM secrets;"
psql "postgresql://user:pass@TEST_INSTANCE_IP:5432/keyfate" -c "SELECT COUNT(*) FROM users;"

echo "Cleanup test instance"
gcloud sql instances delete $TEST_INSTANCE --quiet
```

## Monitoring & Alerts

### Backup Success Monitoring

Set up Cloud Monitoring alerts:

```yaml
alertPolicy:
  displayName: "Cloud SQL Backup Failure"
  conditions:
    - displayName: "Backup failed in last 25 hours"
      conditionThreshold:
        filter: |
          resource.type="cloudsql_database"
          metric.type="cloudsql.googleapis.com/database/backup/success"
        comparison: COMPARISON_LT
        thresholdValue: 1
        duration: 86400s
  notificationChannels:
    - projects/PROJECT_ID/notificationChannels/CHANNEL_ID
```

### Backup Age Alert

Alert if no backup in 25 hours:

```bash
# Check backup age
LATEST_BACKUP=$(gcloud sql backups list --instance=keyfate-db --limit=1 --format="value(windowStartTime)")
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(date -d "$LATEST_BACKUP" +%s)) / 3600 ))

if [ $BACKUP_AGE_HOURS -gt 25 ]; then
  echo "ALERT: Latest backup is $BACKUP_AGE_HOURS hours old"
fi
```

## Disaster Recovery Scenarios

### Scenario 1: Accidental Data Deletion

**Recovery Steps:**

1. Identify timestamp before deletion
2. Create PITR instance at that timestamp
3. Export affected data
4. Import to production database
5. Verify data integrity

**Estimated Time:** 2-3 hours

### Scenario 2: Database Corruption

**Recovery Steps:**

1. Stop application traffic
2. Restore from most recent backup
3. Apply transaction logs if available
4. Verify data integrity
5. Resume application traffic

**Estimated Time:** 3-4 hours

### Scenario 3: Regional Failure

**Recovery Steps:**

1. Promote read replica in different region (if configured)
2. Update DNS/connection strings
3. Verify data consistency
4. Monitor application health

**Estimated Time:** 1-2 hours (if replica exists)

## Backup Validation Checklist

Run monthly:

- [ ] Verify automated backup completed successfully
- [ ] Check backup size (should be consistent with data growth)
- [ ] Test restore to separate instance
- [ ] Verify row counts match production
- [ ] Verify critical secrets can be reconstructed
- [ ] Document actual recovery time
- [ ] Delete test restore instance
- [ ] Update runbook with any learnings

## Contact Information

**On-Call DBA:** [contact info]\
**Cloud SQL Support:** Google Cloud Support Console\
**Escalation:** [escalation procedure]

## Revision History

- **2024-10-27:** Initial documentation
- **[Date]:** [Update description]
