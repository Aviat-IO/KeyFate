# Automatic Database Migrations Design

## Context

The application uses Drizzle ORM for database schema management and migrations.
Currently, migrations are run manually from developer machines, which requires
either temporary public IP access or VPN connectivity to the private database
network.

With Cloud SQL Auth Proxy and VPC connector now in place, the Cloud Run service
has secure private access to the database. This makes it ideal to run migrations
as part of the container startup process.

### Current Deployment Flow

1. Build Docker image with Next.js application
2. Push image to Artifact Registry
3. Deploy to Cloud Run
4. **Manual step**: Developer runs migrations from local machine

### Proposed Deployment Flow

1. Build Docker image with Next.js application + migration script
2. Push image to Artifact Registry
3. Deploy to Cloud Run
4. **Automatic**: Container runs migrations on startup before accepting traffic
5. Container starts Next.js server

## Goals / Non-Goals

### Goals

- Automate database migrations during deployment
- Eliminate need for manual migration steps
- Maintain zero-downtime deployments where possible
- Provide clear logging and error reporting for migration issues

### Non-Goals

- Implement complex migration orchestration (current scale doesn't require it)
- Add migration rollback automation (manual rollback is acceptable)
- Create separate migration job infrastructure (adds unnecessary complexity)

## Technical Design

### Migration Wrapper Script

**Location**: `frontend/scripts/migrate-and-start.sh`

```bash
#!/bin/bash
set -e

echo "🗄️  Starting database migration..."

# Run migrations
if npm run db:migrate:prod; then
  echo "✅ Database migrations completed successfully"
else
  echo "❌ Database migration failed"
  exit 1
fi

echo "🚀 Starting Next.js server..."

# Start the Next.js server
exec npm start
```

**Key Design Decisions:**

- Use `set -e` to exit on any error
- Use `exec` for npm start to replace the shell process (proper signal handling)
- Exit with non-zero code on migration failure (prevents Cloud Run from marking
  revision as healthy)
- Log clearly to Cloud Run logs for debugging

### Dockerfile Changes

**Current**:

```dockerfile
CMD ["npm", "start"]
```

**Proposed**:

```dockerfile
# Copy migration script
COPY scripts/migrate-and-start.sh /app/scripts/
RUN chmod +x /app/scripts/migrate-and-start.sh

# Use wrapper script as entrypoint
CMD ["/app/scripts/migrate-and-start.sh"]
```

**Alternative (using ENTRYPOINT)**:

```dockerfile
ENTRYPOINT ["/app/scripts/migrate-and-start.sh"]
```

**Decision**: Use CMD to allow easy override for debugging if needed.

### Package.json Updates

Add production-specific migration script:

```json
{
  "scripts": {
    "db:migrate": "drizzle-kit migrate",
    "db:migrate:prod": "drizzle-kit migrate --config=drizzle.config.ts"
  }
}
```

**Decision**: Keep simple, use default config. The DATABASE_URL environment
variable will point to the correct database (staging vs production).

### Dependency Management

**Current**: drizzle-kit likely in `devDependencies`

**Required**: Move drizzle-kit to `dependencies` so it's available in production
container

```json
{
  "dependencies": {
    "drizzle-kit": "^0.20.0",
    "drizzle-orm": "^0.29.0"
  }
}
```

## Error Handling

### Migration Failure Scenarios

| Scenario                                  | Behavior                                              | Recovery                               |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Syntax error in migration                 | Container exits with code 1, deployment fails         | Fix migration, redeploy                |
| Migration timeout                         | Container startup timeout, deployment fails           | Optimize migration or increase timeout |
| Concurrent migration (multiple instances) | First succeeds, others skip (Drizzle handles locking) | No action needed                       |
| Network issue to database                 | Container exits, deployment fails                     | Check VPC connector, retry deployment  |

### Cloud Run Behavior

- Container exits during startup → Cloud Run marks revision as unhealthy
- Previous revision continues serving traffic (zero-downtime)
- Deployment marked as failed, alerts triggered
- Manual intervention required to fix and redeploy

## Performance Considerations

### Startup Time Impact

- Migration execution time: Typically <5 seconds for schema changes
- Worst case: <30 seconds for large data migrations
- Cloud Run startup probe timeout: Default 240 seconds (sufficient)

### Recommendation for Large Migrations

For migrations that modify large amounts of data:

1. Test migration duration in staging
2. If > 60 seconds, consider running as separate one-off job first
3. Then deploy application code change

### Concurrent Deployments

- Cloud Run deploys new revisions gradually (rolling update)
- Multiple containers may start simultaneously
- Drizzle migration system handles concurrent execution:
  - Uses database-level locking
  - First container runs migrations
  - Subsequent containers skip (migrations already applied)

## Monitoring & Observability

### Success Indicators

- Cloud Run logs show: "✅ Database migrations completed successfully"
- Cloud Run revision marked as healthy
- Application serves traffic normally

### Failure Indicators

- Cloud Run logs show: "❌ Database migration failed"
- Container exit code: 1
- Cloud Run revision fails to deploy
- Previous revision continues serving traffic

### Alerts

Configure Cloud Monitoring alerts for:

- Deployment failure (existing)
- Container startup failure (existing)
- No additional alerts needed - existing deployment monitoring covers this

## Rollback Strategy

### Automated Rollback

If deployment fails due to migration error:

1. Cloud Run automatically keeps previous revision serving traffic
2. New revision never becomes healthy
3. No manual rollback needed

### Manual Rollback of Migration

If migration succeeds but application code has bugs:

1. Rollback Cloud Run to previous revision (immediate)
2. If migration is not backward compatible:
   - Connect via Cloud Shell
   - Manually run rollback migration or SQL fix
   - Redeploy correct version

### Prevention

- Test all migrations in staging first
- Keep migrations small and focused
- Prefer backward-compatible migrations
- Avoid destructive operations (DROP) in migrations

## Security Considerations

### Database Credentials

- Already handled via DATABASE_URL secret in Secret Manager
- Migration script uses same credentials as application
- No additional secrets needed

### Migration Files

- Migration files are part of source code (already in git)
- Bundled into Docker image (same security as application code)
- No sensitive data in migration files (schema only)

### Principle of Least Privilege

- Application service account already has database write access (required for
  app)
- Migrations use same service account (appropriate)
- No elevation of privileges required

## Alternatives Considered

### Alternative 1: Cloud Run Jobs

**Approach**: Create separate Cloud Run Job for migrations, run before deploying
service

**Pros**:

- Separates migration from application deployment
- Can run migrations without deploying new code

**Cons**:

- More complex infrastructure (additional Terraform resources)
- Requires orchestration (Cloud Build or manual triggering)
- Adds deployment steps and potential failure points
- Overkill for current application scale

**Decision**: Rejected - Too complex for current needs. Revisit if we need
separate migration management.

### Alternative 2: Cloud Build Step

**Approach**: Run migrations as a Cloud Build step before deploying

**Pros**:

- Migrations run before code deployment
- Can fail build early if migrations fail

**Cons**:

- Cloud Build doesn't have direct VPC access (needs VPC peering or connector)
- Requires additional Cloud Build configuration
- Migration runs outside the deployed container environment
- Database credentials need to be available to Cloud Build

**Decision**: Rejected - Requires additional networking setup and credentials
management.

### Alternative 3: Init Container

**Approach**: Use Kubernetes-style init container pattern

**Cons**:

- Cloud Run doesn't support init containers (it's not Kubernetes)

**Decision**: Not applicable.

### Alternative 4: Database Migration Service

**Approach**: Use a managed service like Liquibase Cloud or Flyway Teams

**Cons**:

- Additional cost (~$50-200/month)
- Additional vendor dependency
- Overkill for simple schema migrations
- Drizzle already provides migration management

**Decision**: Rejected - Not needed for current scale and complexity.

## Implementation Notes

### Testing Strategy

1. **Local testing**: Test script locally with Docker
2. **Staging deployment**: Deploy to staging, verify migrations run
3. **Staging verification**: Check logs, verify database schema
4. **Production deployment**: Deploy to production during low-traffic period
5. **Monitor**: Watch Cloud Run logs and metrics for 24 hours

### Migration Best Practices

To ensure smooth automated migrations:

1. **Idempotent**: Migrations should be safe to run multiple times
2. **Small**: Keep migrations focused and quick
3. **Backward compatible**: New code should work with old schema (when possible)
4. **Tested**: Always test in staging first
5. **Reversible**: Know how to rollback if needed

### Drizzle Migration Handling

Drizzle's migration system automatically:

- Tracks applied migrations in `__drizzle_migrations` table
- Skips already-applied migrations
- Applies only pending migrations
- Handles concurrent execution (first wins, others skip)

This makes it safe to run on every deployment - if no migrations are pending,
execution is instantaneous.

## Open Questions

None - design is straightforward and leverages existing Drizzle functionality.
