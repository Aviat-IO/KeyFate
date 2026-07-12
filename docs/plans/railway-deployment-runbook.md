# Railway deployment runbook

## Deployment contract

The `dead-mans-switch` service uses `frontend/railway.json` with the repository service root set to `/frontend`.
Railway builds `frontend/Dockerfile`, then runs this deployment-level pre-deploy command before the new application
version starts:

```bash
bun run db:migrate:production
```

The Docker `CMD` starts only `build/index.js`. Do not add migration execution to the Docker entrypoint, application
startup, cron scheduler, or replica lifecycle. That would allow overlapping Railway replicas to run migrations
independently.

Railway's pre-deploy container receives service environment variables, including `DATABASE_URL`, and does not rely
on a persistent volume. Migration failure must fail the deployment before new replicas serve traffic. The migrations
are additive and the command is retry-idempotent through Drizzle's migration journal.

## Required Railway settings

For both `staging` and `production`:

1. Keep the service root directory `/frontend`.
2. Confirm Config-as-Code detects `railway.json` and the Dockerfile builder.
3. Confirm the effective pre-deploy command is exactly `bun run db:migrate:production` once. Do not configure a
   second migration command in the service UI.
4. Keep `DATABASE_URL` supplied by the environment's PostgreSQL service.
5. Keep the application start command unset so the image `CMD ["bun", "run", "build/index.js"]` is authoritative.
6. Gate deployment on the required GitHub CI jobs before promotion.

## Staging evidence gate

Before production promotion, retain evidence for the exact Git SHA:

- Railway build logs identify the expected Docker image revision.
- The single pre-deploy phase reports `Database migrations completed.`
- A retry/redeploy does not add duplicate rows to `drizzle.__drizzle_migrations`.
- `/api/health/live` succeeds after startup.
- `/api/health/ready` succeeds with the staging database and required configuration.
- Two overlapping replicas do not execute migration commands in their application logs.
- Scheduled jobs, exports, Nostr delivery, payments, and disclosure recovery pass their credentialed staging checks.

Use Railway's linked-branch deployment; do not use `railway up` for this service. Inspect runtime logs with:

```bash
railway logs --service dead-mans-switch -e staging
railway logs --service dead-mans-switch -e production
```

## Failure and rollback

- If pre-deploy fails, stop promotion and inspect the migration error; do not start the new image manually.
- Migrations `0009` and `0010` are additive. Roll application code back to the last green image while leaving the
  added nullable/defaulted columns in place.
- Do not write an ad hoc down migration. For destructive recovery, restore the verified PostgreSQL backup into an
  isolated database first, validate it, then follow the approved incident procedure.
- Record the deployment ID, image digest/Git SHA, migration output, health evidence, rollback owner, and timestamps.

This repository configuration is locally validated only. Credentialed Railway observation remains a release gate.
