# Historical Migration Reset Record

> **Do not use this file as an operating procedure.** It records a past development-only migration-chain repair. Deleting migration artifacts, resetting staging/production, editing generated SQL, or manually changing Drizzle's journal is prohibited for the current application.

## Historical context

An earlier migration chain had missing or incorrectly named snapshots. At that time, before the current production chain existed, the development artifacts were rebuilt into a new baseline.

That event does not authorize another reset. The current repository contains an ordered generated migration chain and deployed environments may contain data written by older application versions.

## Current migration procedure

1. Modify `frontend/src/lib/db/schema.ts`.
2. Generate the migration with Drizzle Kit:

   ```bash
   cd frontend
   bunx drizzle-kit generate --name='description_of_change'
   ```

3. Review the generated SQL without editing it.
4. Commit all three artifact classes together:
   - `drizzle/NNNN_name.sql`
   - `drizzle/meta/NNNN_name_snapshot.json`
   - `drizzle/meta/_journal.json`
5. Validate against an isolated PostgreSQL 16 database:

   ```bash
   DATABASE_URL='<isolated-postgresql-url>' bunx drizzle-kit check
   DATABASE_URL='<isolated-postgresql-url>' bun run db:migrate:production
   DATABASE_URL='<isolated-postgresql-url>' bun run db:migrate:production
   ```

6. Run upgrade/mixed-version and isolated restore tests.
7. Let Railway run the migration once as the deployment-level pre-deploy command.

## Prohibited actions

- deleting the current SQL/snapshot/journal chain;
- manually creating or editing migration artifacts;
- `drizzle-kit push` in staging or production;
- dropping or recreating a staging/production database for deployment;
- restoring a backup over its source database;
- writing an ad hoc down migration;
- changing the journal to make a failed deployment appear successful.

## Recovery

If a migration fails, stop promotion and investigate. Roll application code back to the prior compatible image while leaving additive migrations in place. If destructive recovery is required, first restore a verified backup into an isolated database and follow the approved incident procedure.

See [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) and [`docs/plans/railway-deployment-runbook.md`](docs/plans/railway-deployment-runbook.md).
