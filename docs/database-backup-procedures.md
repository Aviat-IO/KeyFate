# Railway PostgreSQL Backup and Recovery Procedures

> **Status:** Procedure defined; provider capability, retention, alert delivery, RPO, and RTO remain unverified until a credentialed drill records evidence. Never treat desired targets as measured results.

KeyFate uses a dedicated Railway PostgreSQL service in each environment. Restores are isolation-only: never restore over staging or production, never reset a live database, and never use a restore drill as a migration shortcut.

## Ownership and prerequisites

Before a drill, record:

- database owner and incident commander;
- Railway project, environment, PostgreSQL service, and source database;
- backup/PITR identifier and source timestamp;
- exact application Git SHA and migration journal count;
- isolated restore destination and destruction deadline;
- approved evidence location.

The database owner must verify the actual Railway plan provides the required backup/PITR capability and retention. Do not copy assumed plan limits into this document.

## Backup verification

In the Railway dashboard/provider controls:

1. Confirm backups or PITR are enabled for the intended PostgreSQL service.
2. Record the latest successful recovery point and retention shown by the provider.
3. Verify a named operator receives backup-failure/age alerts.
4. Record only identifiers, timestamps, and sanitized settings. Never record credentials or connection strings.

A logical `pg_dump` may supplement managed backups, but it does not prove managed PITR works and must be encrypted, access-controlled, retained, and destroyed under an approved policy.

## Isolation-only restore drill

1. Create a new disposable PostgreSQL destination that cannot receive production traffic.
2. Restrict access to the named database operator.
3. Restore the selected managed backup/PITR point into that destination using Railway's current supported controls.
4. Do not change the application production `DATABASE_URL`.
5. Connect only with a temporary restore-specific credential.
6. Run the verification below.
7. Record actual elapsed recovery time and the difference between the selected recovery point and the failure/reference time.
8. Destroy or retain the isolated copy according to the approved evidence/data-retention decision; record completion.

If provider-managed restore controls cannot create an isolated destination, stop the drill and escalate. Do not fall back to restoring over the source.

## Verification

### Migration chain

```sql
SELECT count(*) AS applied_migrations
FROM drizzle.__drizzle_migrations;
```

Compare the result to `frontend/drizzle/meta/_journal.json` for the exact candidate. A mismatch fails the drill.

### Critical table availability

```sql
SELECT 'users' AS table_name, count(*) AS rows FROM users
UNION ALL SELECT 'secrets', count(*) FROM secrets
UNION ALL SELECT 'secret_recipients', count(*) FROM secret_recipients
UNION ALL SELECT 'checkin_history', count(*) FROM checkin_history
UNION ALL SELECT 'disclosure_log', count(*) FROM disclosure_log
UNION ALL SELECT 'data_export_jobs', count(*) FROM data_export_jobs
UNION ALL SELECT 'bitcoin_utxos', count(*) FROM bitcoin_utxos
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;
```

Counts are sanity evidence, not proof of semantic integrity. Compare with source-side counts captured for the same recovery point when available.

### Lease and terminal-state integrity

```sql
SELECT status, count(*)
FROM secrets
GROUP BY status
ORDER BY status;

SELECT status, count(*)
FROM disclosure_log
GROUP BY status
ORDER BY status;

SELECT status, count(*)
FROM data_export_jobs
GROUP BY status
ORDER BY status;
```

Investigate impossible terminal/lease combinations using the current schema and runbooks. Do not mutate restored rows merely to make checks pass.

### Recovery metadata

```sql
SELECT
  count(*) FILTER (WHERE nostr_scheme_version = 2) AS nostr_v2_recipients,
  count(*) FILTER (WHERE nostr_capsule_event_id IS NOT NULL) AS bound_capsules
FROM secret_recipients;

SELECT network, generation, status, count(*)
FROM bitcoin_utxos
GROUP BY network, generation, status
ORDER BY network, generation, status;
```

Verify representative Nostr public bindings and Bitcoin generations without decrypting or exporting private recovery material.

### Application compatibility

Against the isolated destination only:

```bash
cd frontend
DATABASE_URL='<isolated-restore-url>' bun run db:migrate:production
DATABASE_URL='<isolated-restore-url>' bunx drizzle-kit check
```

The migration retry must be idempotent. Then start the exact candidate image in an isolated test environment and require readiness 200. Do not send real email, payment, Nostr, or Bitcoin side effects during a restore drill.

## Measuring recovery

Record, do not predeclare:

- **Observed RPO:** reference/failure time minus the newest verified restored recovery point.
- **Observed RTO:** authorization/start time through verified application readiness and integrity checks.
- backup/PITR identifier;
- restore start/end timestamps;
- validation queries and sanitized results;
- defects, manual steps, and alert behavior;
- isolated-copy destruction/retention result.

Service claims may use only measured, repeated evidence approved by accountable owners.

## Failure handling

Stop and escalate if:

- the provider cannot produce an isolated restore;
- the migration journal differs from the repository chain;
- critical tables or recovery metadata are missing;
- the candidate cannot become ready against the restored database;
- credentials or sensitive recovery material appear in logs/evidence;
- cleanup of the isolated copy cannot be confirmed.

Do not perform an in-place restore, production reset, ad hoc down migration, or manual journal edit.

## Evidence record

```text
Gate: Managed PostgreSQL backup/PITR restore drill
Environment:
Named owner:
Source service/database:
Backup or recovery-point identifier:
Requested recovery timestamp:
Restore destination:
Restore started/completed (UTC):
Exact Git SHA/image digest:
Migration journal expected/observed:
Integrity-query evidence location:
Observed RPO:
Observed RTO:
Alert delivery result:
Isolated-copy destruction/retention result:
Pass/fail and limitations:
Approver:
```
