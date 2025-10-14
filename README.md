# KeyFate (Dead Man's Switch)

A secure digital service that automatically triggers an alarm or other emergency response when the user is incapacitated.

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

**Payment testing:** See [PAYMENT_TESTING.md](./PAYMENT_TESTING.md) for BTCPay Server and Stripe testing

## Alternative Setup Options

1. **Deploy Infrastructure:** See [Infrastructure README](infrastructure/README.md) for automated Terragrunt deployment
2. **Frontend Development:** See [Frontend README](frontend/README.md) for local development setup

## Tech Stack

### Local Development

- **Frontend:** Next.js, TypeScript, Tailwind CSS, Shadcn UI
- **Database:** PostgreSQL 16 (Docker)
- **ORM:** Drizzle ORM
- **Orchestration:** Docker Compose, Make
- **Caching:** Redis 7 (optional)

### Production Options

- **Infrastructure:** Google Cloud Run, Terraform, Terragrunt
- **Database:** Google Cloud SQL (PostgreSQL)
- **Security:** Client-side Shamir's Secret Sharing, Secret Manager

## Database Connection

For production environments, the application connects to Google Cloud SQL PostgreSQL instances with SSL encryption enabled by default. Local development uses Docker PostgreSQL containers.

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
npm run db:push  # Push schema changes
# or
# Run pending migrations
npm run db:migrate

# To migrate staging
npm run db:migrate -- --config=drizzle-staging.config.ts

# To migrate production
npm run db:migrate -- --config=drizzle-production.config.ts
```

### Drizzle Kit Studio (Database GUI)

Drizzle Kit Studio provides a web-based interface to browse and manage your database:

```bash
# For local development (using Docker PostgreSQL)
cd frontend
DATABASE_URL="postgresql://keyfate_app:password@localhost:54321/keyfate_dev?sslmode=disable" npm run db:studio

# For Cloud SQL with PRIVATE IP (most common for production)
# NOTE: Private IPs are only accessible from within the same VPC network.
# For local development, you'll need to use one of these approaches:

# Option 1: Use Cloud Shell (runs within Google Cloud)
# Open Cloud Shell at https://console.cloud.google.com
# Then run (note: database name is 'keyfate'):
DATABASE_URL="postgresql://keyfate_app:YOUR_PASSWORD@10.2.0.3:5432/keyfate" npm run db:studio

# Option 2: Set up SSH tunnel through a VM in the same VPC
# First SSH to a VM in the same network:
gcloud compute ssh YOUR_VM_NAME --zone=us-central1-a -- -L 54321:10.2.0.3:5432
# Then in another terminal (note: database name is 'keyfate'):
DATABASE_URL="postgresql://keyfate_app:YOUR_PASSWORD@localhost:54321/keyfate" npm run db:studio

# Option 3: Enable public IP on the Cloud SQL instance (less secure)
# Go to Cloud Console > SQL > Your Instance > Edit > Connections > Add Network
# Add your local IP address to authorized networks, then use:
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging

# For Cloud SQL with PUBLIC IP (less common)
# Note: Database name is 'keyfate' (not environment-specific)
cloud-sql-proxy --port=54321 keyfate-dev:us-central1:keyfate-postgres-staging
DATABASE_URL="postgresql://keyfate_app:YOUR_PASSWORD@localhost:54321/keyfate?sslmode=require" npm run db:studio

# Alternative: Direct connection if your IP is whitelisted
DATABASE_URL="postgresql://keyfate_app:YOUR_PASSWORD@CLOUD_SQL_PUBLIC_IP:5432/keyfate?sslmode=require" npm run db:studio
```

**Note:** If you get "instance does not have IP of type PUBLIC" error, your Cloud SQL instance is using private IP only. Use the private IP options above or enable public IP in the Cloud SQL console.

Studio will open at `https://local.drizzle.studio` by default.
