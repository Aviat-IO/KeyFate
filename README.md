# KeyFate (Dead Man's Switch)

A zero-knowledge dead man's switch for encrypted secret recovery. KeyFate helps a
user prepare sensitive information for release to chosen recipients if the user
misses check-ins, while keeping secret creation and recovery client-side.

## Public alpha review package

Start here if you are evaluating KeyFate without private project context:

- [Alpha release notes and checklist](./docs/release/alpha-0.1.0.md)
- [Self-hosting guide](./docs/self-hosting.md)
- [Product walkthrough outline](./docs/demos/product-walkthrough.md)
- [Nostr recovery demo outline](./docs/demos/nostr-recovery.md)
- [Offline recovery demo outline](./docs/demos/offline-recovery.md)

No public alpha tag or GitHub release has been cut by this branch. The proposed
review tag is `v0.1.0-alpha.1`.

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

**Payment testing:** Stripe and BTCPay Server are optional for alpha review. See
[docs/self-hosting.md](./docs/self-hosting.md) for required environment
variables.

## Alternative Setup Options

1. **Self-hosting:** See [docs/self-hosting.md](./docs/self-hosting.md) for the
   alpha reviewer/operator setup.
2. **Frontend development:** Run commands from `frontend/` with Bun.

## Tech Stack

### Local Development

- **Frontend:** SvelteKit 5, TypeScript, Tailwind CSS, shadcn-svelte
- **Database:** PostgreSQL 16 (Docker)
- **ORM:** Drizzle ORM
- **Orchestration:** Docker Compose, Make
- **Caching:** Redis 7 (optional)

### Production Options

- **Infrastructure:** Google Cloud Run, Terraform, Terragrunt
- **Database:** Google Cloud SQL (PostgreSQL)
- **Security:** Client-side Shamir's Secret Sharing, Secret Manager

## Database Connection

For production environments, the application connects to Google Cloud SQL
PostgreSQL instances with SSL encryption enabled by default. Local development
uses Docker PostgreSQL containers.

### Running Database Migrations

**Local Development:**

```bash
# Migrations run automatically with Docker Compose
make dev
```

**Production/Staging:**

Option 1 - Direct SQL migration:

```bash
# Connect to Cloud SQL instance and run migrations
# Note: Both staging and prod use the 'keyfate' database (not environment-specific)
gcloud sql connect keyfate-postgres-staging --user=postgres --database=keyfate --project=keyfate-dev < database/migrations/20241231_local_schema.sql.backup
```

Option 2 - Using Drizzle ORM:

```bash
# From frontend directory, push schema to database
cd frontend
bunx drizzle-kit push  # Push schema changes for non-production review use
# or
# Run pending migrations
bunx drizzle-kit migrate

# To migrate staging/production, use the environment-specific DATABASE_URL and
# run the same Drizzle migration command from frontend/.
```

### Connecting to Cloud SQL Database

For secure access to production/staging Cloud SQL databases, use the **bastion
host** with Identity-Aware Proxy (IAP).

#### Using Bastion Host (Recommended)

The bastion host provides secure access to Cloud SQL via SSH tunnel with Cloud
SQL Auth Proxy pre-installed:

**Step 1: Create SSH tunnel to bastion**

The Cloud SQL Proxy runs automatically on the bastion host via systemd. Simply
create an SSH tunnel:

```bash
# For staging
gcloud compute ssh --zone=us-central1-a bastion-host --project=keyfate-dev \
  --tunnel-through-iap \
  --ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'

# For production
gcloud compute ssh --zone=us-central1-a bastion-host --project=keyfate-prod \
  --tunnel-through-iap \
  --ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'
```

This creates an SSH tunnel from your local port 54321 to the bastion's Cloud SQL
Proxy listening on port 5432.

Leave this terminal running with the tunnel active.

**Step 2: Connect to database**

In a second terminal, connect to the database using the forwarded port:

```bash
# Connect with psql
psql "postgresql://keyfate_app:YOUR_PASSWORD@localhost:54321/keyfate"

# Or run migrations
cd frontend
npm run db:migrate -- --config=drizzle-staging.config.ts

# Or use Drizzle Studio
npm run db:studio -- --config=drizzle-staging.config.ts
```

When done, press Ctrl+C in the first terminal to stop the tunnel and proxy.

#### Using Cloud SQL Proxy Locally (Alternative)

Download and run Cloud SQL Proxy on your local machine (requires appropriate IAM
permissions):

```bash
# Install Cloud SQL Proxy v2 (macOS)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# Run proxy on port 54321 (get CONNECTION_NAME from terraform outputs)
# Syntax: cloud-sql-proxy --port PORT CONNECTION_NAME
./cloud-sql-proxy --port 54321 keyfate-dev:us-central1:keyfate-postgres-staging

# Connect in another terminal
psql "postgresql://keyfate_app:YOUR_PASSWORD@localhost:54321/keyfate"

# Or run migrations
cd frontend
npm run db:migrate -- --config=drizzle-staging.config.ts
```

#### Using Drizzle Kit Studio

Drizzle Kit Studio provides a web-based interface to browse and manage your
database:

```bash
# For local development (using Docker PostgreSQL)
cd frontend
npm run db:studio

# For staging (via bastion host SSH tunnel)
# First set up the tunnel (see bastion instructions above), then:
npm run db:studio -- --config=drizzle-staging.config.ts

# For production (via bastion host SSH tunnel)
# First set up the tunnel (see bastion instructions above), then:
npm run db:studio -- --config=drizzle-production.config.ts
```

Studio will open at `https://local.drizzle.studio` by default.
