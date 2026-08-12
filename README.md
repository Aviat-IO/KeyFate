# KeyFate (Dead Man's Switch)

A secure digital service that automatically triggers an alarm or other emergency
response when the user is incapacitated.

## 🚀 Quick Start (Local Development)

**Complete local development environment** with PostgreSQL and Docker:

```bash
# 1. Set up local environment
make install

# 2. Start development stack
make dev

# 3. Open application
open http://localhost:3000
```

**Development credentials:**

- dev@localhost / password123 (Free tier)
- test@localhost / password123 (Pro tier)

For detailed setup instructions, see [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)

## Freedom-tech roadmap

- [Grant roadmap](./docs/grants/README.md): HRF, OpenSats, and NLnet briefs plus a 12-16 week milestone plan.
- [Threat model](./docs/threat-model.md): assets, adversaries, trust boundaries, mitigations, and residual risks for KeyFate's dead man's switch workflow.

**Payment testing:** See [PAYMENT_TESTING.md](./PAYMENT_TESTING.md) for BTCPay
Server and Stripe testing

## Additional Setup

1. **Production deployment:** See the [Railway deployment runbook](docs/plans/railway-deployment-runbook.md).
2. **Frontend development:** See [Frontend README](frontend/README.md) for local development setup.

## Tech Stack

- **Frontend:** SvelteKit 5 and Svelte 5 runes
- **Runtime/package manager:** Bun 1.3.14
- **Database:** PostgreSQL through Drizzle ORM
- **Authentication:** Auth.js v5
- **Styling:** Tailwind CSS 4 and shadcn-svelte
- **Production:** Railway Docker service and Railway PostgreSQL

## Database Migrations

Change `frontend/src/lib/db/schema.ts`, then generate migrations with Drizzle Kit. Never hand-write or edit
generated migration artifacts:

```bash
cd frontend
bunx drizzle-kit generate --name="description_of_change"
```

Commit the generated SQL, snapshot JSON, and `drizzle/meta/_journal.json` together.

For a local or isolated database:

```bash
cd frontend
DATABASE_URL="postgresql://..." bun run db:migrate:production
```

Production and staging migrations run only as Railway's deployment-level pre-deploy command, configured in
`frontend/railway.json`:

```bash
bun run db:migrate:production
```

Do not run migrations from the Docker entrypoint, application startup, cron scheduler, or each replica. Do not use
`drizzle-kit push` in staging or production. See the
[Railway deployment runbook](docs/plans/railway-deployment-runbook.md) for evidence and rollback requirements.

## Validation

```bash
cd frontend
bun run lint
bun run check
bun test
bun run build
```
