# Database URL Configuration

> KeyFate uses one canonical `DATABASE_URL`. The application does not assemble production credentials from `DB_HOST`/`DB_PASSWORD` fragments. Do not print connection strings in logs, CI output, evidence, or chat.

## Railway

Railway injects `DATABASE_URL` from the PostgreSQL service into the `dead-mans-switch` service. Configure a variable reference in each environment rather than copying a credential into the repository.

Production and staging use separate PostgreSQL services and databases. Verify the effective value from Railway's variable controls without exposing it.

## Transport policy

`frontend/src/lib/db/connection-policy.ts` enforces:

- `postgresql://` or `postgres://`;
- explicit username and database name;
- `sslmode=verify-full` for production TCP connections;
- no `sslmode=disable` on TCP;
- bounded pool/connect/statement timeouts;
- Unix sockets only through the explicitly validated `host=/absolute/socket` representation.

A production TCP example, with placeholders only:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full
```

The runtime trust store must validate the server certificate. Do not weaken certificate verification to make readiness pass.

## Local development

The repository Docker Compose PostgreSQL service may use a local non-production URL in an ignored `.env.local` file:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/keyfate_dev
```

Never reuse local credentials in staging or production.

## Validation

Run connection-policy tests and an isolated database gate:

```bash
cd frontend
bun test src/lib/db/__tests__/connection-policy.test.ts

DATABASE_URL='<isolated-postgresql-url>' bun run db:migrate:production
DATABASE_URL='<isolated-postgresql-url>' bunx drizzle-kit check
```

Production readiness additionally requires:

- `/api/health/live` returns 200 without checking PostgreSQL;
- `/api/health/ready` returns 503 for invalid configuration or unavailable PostgreSQL;
- `/api/health/ready` returns 200 against migrated PostgreSQL over verified TLS;
- `pg_stat_ssl` confirms the application connection uses TLS;
- no connection string or password appears in retained output.

## Rotation

When rotating database credentials:

1. name the database and release owners;
2. create the replacement credential in Railway/provider controls;
3. update the service variable reference;
4. deploy and verify readiness plus critical queries;
5. revoke the old credential;
6. record identifiers/timestamps only, never secret values.

See [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) and [`docs/database-backup-procedures.md`](docs/database-backup-procedures.md).
