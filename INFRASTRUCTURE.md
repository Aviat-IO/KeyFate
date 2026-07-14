# KeyFate Infrastructure

## Supported architecture

| Concern     | Development                      | Staging / Production                                 |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| Application | SvelteKit adapter-node on Bun    | Railway Docker service `dead-mans-switch`            |
| Database    | PostgreSQL 16 via Docker Compose | Dedicated Railway PostgreSQL service per environment |
| Build       | `bun run build`                  | `frontend/Dockerfile`                                |
| Deployment  | Local process                    | Railway linked Git branch, service root `/frontend`  |
| Migrations  | Explicit local command           | One Railway pre-deploy command                       |
| Scheduler   | In-process, optional locally     | In-process with PostgreSQL coordination              |

GCP/Cloud Run/Cloud SQL/Terragrunt documents are historical unless explicitly labeled otherwise. They are not current deployment instructions.

## Local development

Prerequisites:

- Bun 1.3.14
- Docker with Compose
- PostgreSQL client tools when running database drills

Start PostgreSQL:

```bash
docker compose up -d postgres
cd frontend
bun install --frozen-lockfile
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/keyfate_dev' \
  bun run db:migrate:production
bun run dev
```

Optional development-only services:

```bash
docker compose up -d redis
docker compose --profile admin up -d pgadmin
```

The production application does not depend on the Compose Redis or pgAdmin services.

## Validation

```bash
cd frontend
bun run lint
bun run check
bun test
bun run test:browser
bun run audit:production
bun run build
```

PostgreSQL integration tests require an isolated database:

```bash
TEST_DATABASE_URL='<isolated-postgresql-url>' \
DATABASE_URL='<isolated-postgresql-url>' \
bun run test:postgres
```

## Database migrations

1. Change `frontend/src/lib/db/schema.ts`.
2. Generate artifacts, never hand-write them:

   ```bash
   cd frontend
   bunx drizzle-kit generate --name='description_of_change'
   ```

3. Review and commit the SQL, snapshot JSON, and `_journal.json` together.
4. Validate fresh install, retry, upgrade compatibility, and restore behavior.

Never use `drizzle-kit push` in staging/production. Never run migrations from application startup or every replica.

## Railway deployment contract

- Project: `keyfate`
- Environments: `staging`, `production`
- Service: `dead-mans-switch`
- Service root: `/frontend`
- Build: `frontend/Dockerfile`
- Pre-deploy: `bun run db:migrate:production`
- Runtime command: `bun run build/index.js`

Deployments occur through Railway's linked branch. Do not use `railway up`.

```bash
railway logs --service dead-mans-switch -e staging
railway logs --service dead-mans-switch -e production
```

## Health and lifecycle

- `GET /api/health/live`: process-only liveness; no external dependencies.
- `GET /api/health/ready`: bounded production configuration and PostgreSQL readiness.
- `GET /api/health`: compatibility alias for readiness.
- SIGTERM/SIGINT/fatal failures stop the scheduler and close PostgreSQL within a bounded shutdown window.

## Security boundaries

- Original secrets and threshold sets remain client-side.
- PostgreSQL is the durable coordination boundary for replicas.
- Production TCP PostgreSQL requires `sslmode=verify-full`.
- Secrets live in Railway/provider secret stores, not files or evidence.
- Bitcoin enrollment remains disabled until the local two-phase reconciliation blocker is closed and funded Signet evidence is approved.
- Nostr and Bitcoin private keys, K, passphrases, and plaintext recovery transactions never cross the server boundary.

## Operations

Canonical procedures:

- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md)
- [`docs/plans/railway-deployment-runbook.md`](docs/plans/railway-deployment-runbook.md)
- [`docs/database-backup-procedures.md`](docs/database-backup-procedures.md)
- [`TODO.md`](TODO.md)

Production promotion requires exact-SHA CI, credentialed staging journeys, live Nostr evidence, closure of the Bitcoin two-phase blocker plus funded Signet evidence, isolated backup/PITR restore evidence, alert delivery, rollback drills, credential rotation, and named approval.
