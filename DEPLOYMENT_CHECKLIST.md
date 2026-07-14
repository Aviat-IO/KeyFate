# Railway Deployment Checklist

> **Canonical production procedure.** KeyFate deploys through Railway's linked Git branch. Do not use `railway up`, reset a database, run `drizzle-kit push`, execute a down migration, or restore over the source database.

See also:

- [`TODO.md`](TODO.md) for release blockers and human ownership
- [`docs/plans/railway-deployment-runbook.md`](docs/plans/railway-deployment-runbook.md) for the deployment contract
- [`docs/database-backup-procedures.md`](docs/database-backup-procedures.md) for isolation-only restore drills

## 1. Candidate identity

- [ ] Worktree contains only intended release files.
- [ ] All generated migration SQL, snapshot JSON, and `drizzle/meta/_journal.json` changes are committed together.
- [ ] Candidate has an exact Git SHA and a green pull-request CI run for that SHA.
- [ ] Required checks and production environment approval are enforced in GitHub/Railway.
- [ ] Rollback target is an identified prior green image/SHA.

## 2. Local and CI gates

Run from `frontend/`:

```bash
bun install --frozen-lockfile
bun run lint
bun run check
bun test
bun run test:browser
bun run audit:production
bun run build
```

Against an isolated PostgreSQL 16 database:

```bash
TEST_DATABASE_URL='<isolated-postgresql-url>' \
DATABASE_URL='<isolated-postgresql-url>' \
bun run test:postgres

DATABASE_URL='<isolated-postgresql-url>' bun run db:migrate:production
DATABASE_URL='<isolated-postgresql-url>' bunx drizzle-kit check
```

- [ ] Migration retry adds no duplicate journal rows.
- [ ] Docker image runs as UID 1001 and starts only `build/index.js`.
- [ ] `/api/health/live` returns 200 without dependencies.
- [ ] `/api/health/ready` returns 503 when required configuration/database access is unavailable.
- [ ] `/api/health/ready` returns 200 against migrated PostgreSQL over verified TLS.
- [ ] OCI revision label matches the exact candidate SHA.

## 3. Staging configuration

- [ ] Railway service root is `/frontend`.
- [ ] Railway builds `frontend/Dockerfile`.
- [ ] The deployment-level pre-deploy command is exactly `bun run db:migrate:production`.
- [ ] Application replicas do not run migrations at startup.
- [ ] `DATABASE_URL` is the staging Railway PostgreSQL connection and satisfies the verified transport policy.
- [ ] Required application, OAuth, Turnstile, SendGrid, payment, cron, encryption, Nostr, and revision variables pass `/api/health/ready`.
- [ ] `BITCOIN_ENROLLMENT_ENABLED=false`; do not run the funded Signet gate until the repository's two-phase Bitcoin reconciliation task is closed and the exact staging exercise is explicitly approved.
- [ ] Secret values are stored only in approved provider/Railway secret stores, never in evidence or this repository.

## 4. Staging evidence gate

Retain evidence for the exact candidate SHA:

- [ ] Railway build identifies the expected source revision and image digest.
- [ ] One pre-deploy phase reports successful migrations.
- [ ] A redeploy/retry leaves the migration journal unchanged.
- [ ] Liveness and readiness are healthy.
- [ ] Two overlapping replicas show no application-level migration execution.
- [ ] Credentialed OAuth, Turnstile, SendGrid, Stripe, BTCPay, cron, export, and enforcing-CSP journeys pass.
- [ ] Live Nostr publish/recover, tamper, retry, and outage cases pass.
- [ ] After the local two-phase blocker is closed, funded Signet setup, maturity, browser restart/import, accepted-then-timeout retry, exact-output finalization, refresh, recipient recovery, and broadcast pass before Bitcoin enrollment can be enabled.
- [ ] Backup/PITR capability and retention are verified from the actual Railway plan.
- [ ] An isolated restore drill passes with measured RPO/RTO.
- [ ] Alert delivery, rolling interruption, provider-accepted-then-crash, and rollback drills pass.

Use the repository staging suite only after approved staging fixtures are configured:

```bash
PLAYWRIGHT_EXTERNAL_BASE_URL='https://staging.keyfate.com' \
STAGING_CREDENTIALS_READY=true \
STAGING_E2E_STORAGE_STATE='<approved-storage-state-path>' \
bun run test:staging
```

Repository tests do not substitute for funded, credentialed, or provider-side evidence.

## 5. Production promotion

- [ ] Named release, security, operations, database, provider, and business owners approved the retained evidence.
- [ ] No unresolved blocker or high-severity finding remains.
- [ ] The exact green staging SHA is the production candidate; no rebuild from a different revision is accepted.
- [ ] Railway linked-branch promotion is approved. Do not use `railway up`.
- [ ] The pre-deploy migration succeeds once before new replicas serve traffic.
- [ ] Production liveness/readiness and critical owner/recipient journeys pass.
- [ ] Deployed revision/digest, migration result, approver, timestamps, and rollback target are recorded.

Inspect runtime logs without mutating the deployment:

```bash
railway logs --service dead-mans-switch -e staging
railway logs --service dead-mans-switch -e production
```

## 6. Rollback

If a pre-deploy migration fails, stop promotion. Do not start the new image manually.

For an application regression:

1. Pause promotion and identify the last green image/SHA.
2. Roll back application code while leaving additive migrations in place.
3. Verify liveness, readiness, scheduler ownership, disclosure/export leases, and critical journeys.
4. Record the incident timeline and recovery result.

Never write an ad hoc down migration. A destructive recovery requires an approved, verified backup restored into an isolated database first.

## Evidence record

```text
Gate:
Environment:
Named owner:
Date/time (UTC):
Exact Git SHA:
Deployed image/revision digest:
Command or workflow URL:
Sanitized output/log location:
Pass/fail result:
Observed limitations:
Rollback target:
Approver:
```
