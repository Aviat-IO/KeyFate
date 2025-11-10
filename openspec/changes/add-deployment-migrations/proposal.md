# Add Automatic Database Migrations on Deployment

## Why

Currently, database migrations must be run manually from a local machine, which
requires either:

1. Temporarily enabling public IPs on Cloud SQL instances (security risk)
2. Setting up VPN access to the private VPC network (complex setup)
3. Using Cloud Shell (inconvenient, not automated)

This creates operational friction and potential for human error (forgetting to
run migrations before deployment, or leaving public IPs enabled).

The proper solution is to run migrations automatically as part of the deployment
process, where the application already has private network access to Cloud SQL
through the VPC connector.

## What Changes

- **Add** pre-startup migration script to Next.js application
- **Update** Dockerfile to include migration command execution before starting
  the server
- **Create** `scripts/migrate-and-start.sh` wrapper script that:
  1. Runs `drizzle-kit migrate` to apply pending migrations
  2. Starts the Next.js production server
- **Update** Cloud Run container command to use the wrapper script
- **Add** proper error handling for migration failures

## Impact

### Benefits

- **Automated**: Migrations run automatically on every deployment
- **Secure**: No need to temporarily enable public IPs or manage local VPN
  access
- **Reliable**: Migrations always run before the new code starts serving traffic
- **Consistent**: Same migration process for staging and production
- **Audit trail**: Migration logs available in Cloud Run logs

### Risks

- **Migration failures could block deployments**: Mitigated by proper error
  handling and rollback
- **Longer startup time**: Acceptable trade-off for automation (typically <10
  seconds)
- **Database locked during migration**: Minimal impact with proper migration
  design (avoid long-running DDL)

### Affected Files

- `frontend/Dockerfile` - Add migration step
- `frontend/scripts/migrate-and-start.sh` - New wrapper script
- `infrastructure/apps/frontend.tf` - May need to update container command
  (likely not needed if using default ENTRYPOINT)
- `frontend/package.json` - Ensure `db:migrate` script is production-ready

### Migration Path

1. Create migration wrapper script
2. Update Dockerfile to copy script and set proper permissions
3. Test in staging environment
4. Deploy to production

### Rollback Plan

If migrations fail or cause issues:

1. Previous Cloud Run revision remains available
2. Can immediately rollback to previous revision via Cloud Run
3. Manual migration fix can be applied via Cloud Shell if needed

## Non-Goals

- Running migrations in a separate Cloud Run Job (adds complexity, not needed
  for current scale)
- Implementing migration rollback automation (manual rollback via `git revert` +
  redeploy is sufficient)
- Adding migration locking mechanism (Drizzle handles this, PostgreSQL provides
  row-level locking)
