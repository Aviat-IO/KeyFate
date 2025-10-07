# Cloud SQL Migration Guide

## Complete Guide for Migrating from Supabase to Google Cloud SQL

This guide provides step-by-step instructions for migrating your application from Supabase PostgreSQL to Google Cloud SQL, including the authorization layer implementation.

---

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Cloud SQL Instance Setup](#cloud-sql-instance-setup)
3. [Schema Migration](#schema-migration)
4. [Authorization Layer Implementation](#authorization-layer-implementation)
5. [Environment Configuration](#environment-configuration)
6. [Connection Pooling Setup](#connection-pooling-setup)
7. [Security Configuration](#security-configuration)
8. [Data Migration](#data-migration)
9. [Post-Migration Validation](#post-migration-validation)
10. [Production Deployment](#production-deployment)

---

## Pre-Migration Checklist

### 1. Backup Current Database

```bash
# Export Supabase database
pg_dump -h db.supabase.co -U postgres -d your_database > backup.sql

# Verify backup
ls -lh backup.sql
```

### 2. Document Current Configuration

- [ ] List all environment variables
- [ ] Document all database users and roles
- [ ] Export Row Level Security (RLS) policies
- [ ] Document all triggers and functions
- [ ] List all database extensions
- [ ] Document connection pool settings

### 3. Prepare Migration Environment

- [ ] Install Google Cloud SDK: `gcloud components install`
- [ ] Authenticate: `gcloud auth login`
- [ ] Set project: `gcloud config set project YOUR_PROJECT_ID`
- [ ] Install required tools: `npm install -g drizzle-kit`

---

## Cloud SQL Instance Setup

### 1. Create Cloud SQL Instance

```bash
# Create PostgreSQL 15 instance
gcloud sql instances create keyfate-db-production \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --enable-ssl \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --availability-type=REGIONAL

# Verify instance creation
gcloud sql instances describe keyfate-db-production
```

### 2. Create Database and Users

```bash
# Create main database
gcloud sql databases create keyfate \
  --instance=keyfate-db-production

# Create application user with strong password
gcloud sql users create keyfate_app \
  --instance=keyfate-db-production \
  --password=$(openssl rand -base64 32)

# Create connection pooling user
gcloud sql users create keyfate_pool \
  --instance=keyfate-db-production \
  --password=$(openssl rand -base64 32)
```

### 3. Configure Network Access

```bash
# For development - add your IP
gcloud sql instances patch keyfate-db-production \
  --authorized-networks=YOUR_IP_ADDRESS

# For production - use Cloud SQL Proxy
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy
```

---

## Schema Migration

### 1. Export Supabase Schema

```bash
# Export schema only (no data yet)
pg_dump -h db.supabase.co \
  -U postgres \
  -d your_database \
  --schema-only \
  --no-owner \
  --no-privileges \
  > supabase-schema.sql
```

### 2. Convert Supabase-Specific Features

**Remove RLS Policies** (we'll implement application-level auth):

```sql
-- These will be removed from the schema
-- DROP POLICY IF EXISTS user_secrets_policy ON secrets;
-- ALTER TABLE secrets DISABLE ROW LEVEL SECURITY;
```

**Update Supabase Extensions**:

```sql
-- Replace Supabase-specific extensions
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

### 3. Apply Schema to Cloud SQL

```bash
# Connect to Cloud SQL
./cloud-sql-proxy PROJECT:REGION:INSTANCE &

# Import schema
psql -h localhost -U keyfate_app -d keyfate < modified-schema.sql

# Or use Drizzle migrations
npm run db:push
```

### 4. Verify Schema

```bash
# Run validation script
ts-node scripts/validate-migration.ts
```

---

## Authorization Layer Implementation

### Overview

We're replacing Supabase's Row Level Security (RLS) with application-level authorization using NextAuth.js and middleware.

### 1. Understanding the Change

**Supabase (Before)**:
- Database-level RLS policies
- Automatic user context from JWT
- Database enforces access rules

**Cloud SQL (After)**:
- Application-level authorization
- NextAuth.js session validation
- Middleware enforces access rules

### 2. Authorization Architecture

```
┌─────────────────────────────────────────────────┐
│              Client Request                     │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│           Next.js Middleware                    │
│   - Session validation                          │
│   - Route protection                            │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│         NextAuth.js Session                     │
│   - User authentication                         │
│   - Session management                          │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│      Application Authorization Layer            │
│   - User ID from session                        │
│   - Resource ownership check                    │
│   - Permission validation                       │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│           Database Queries                      │
│   - WHERE user_id = session.user.id            │
│   - Explicit ownership filtering                │
└─────────────────────────────────────────────────┘
```

### 3. Middleware Configuration

File: `src/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  // Protected routes require authentication
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/secrets/:path*',
    '/api/secrets/:path*',
  ],
};
```

### 4. Database Query Patterns

**Before (Supabase with RLS)**:
```typescript
// RLS automatically filters by user
const { data } = await supabase
  .from('secrets')
  .select('*');
```

**After (Cloud SQL with Application Auth)**:
```typescript
// Explicitly filter by user ID from session
const session = await getServerSession(authOptions);
const secrets = await db
  .select()
  .from(secretsTable)
  .where(eq(secretsTable.userId, session.user.id));
```

### 5. Server Actions Authorization

File: `src/app/actions/secrets.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getSecrets() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // Explicitly filter by user ID
  return await db
    .select()
    .from(secretsTable)
    .where(eq(secretsTable.userId, session.user.id));
}
```

### 6. API Route Authorization

File: `src/app/api/secrets/route.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const secrets = await db
    .select()
    .from(secretsTable)
    .where(eq(secretsTable.userId, session.user.id));

  return Response.json(secrets);
}
```

### 7. Authorization Helper Functions

File: `src/lib/auth-helpers.ts`

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user;
}

export async function requireOwnership(userId: string, resourceUserId: string) {
  if (userId !== resourceUserId) {
    throw new Error('Forbidden: You do not own this resource');
  }
}

export async function getUserId(): Promise<string> {
  const user = await requireUser();
  return user.id;
}
```

### 8. Testing Authorization

```bash
# Test unauthorized access
curl -X GET http://localhost:3000/api/secrets
# Expected: 401 Unauthorized

# Test with valid session
curl -X GET http://localhost:3000/api/secrets \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
# Expected: 200 OK with user's secrets
```

---

## Environment Configuration

### 1. Required Environment Variables

Create `.env.production.local`:

```bash
# Database Configuration
DATABASE_URL="postgresql://keyfate_app:PASSWORD@/keyfate?host=/cloudsql/PROJECT:REGION:INSTANCE"
CLOUD_SQL_CONNECTION_NAME="PROJECT:REGION:INSTANCE"
DATABASE_SSL="true"

# NextAuth Configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://yourdomain.com"

# OAuth Providers (if using)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 2. Cloud Run Environment Variables

```bash
gcloud run services update YOUR_SERVICE \
  --set-env-vars="DATABASE_URL=postgresql://keyfate_app:PASSWORD@/keyfate?host=/cloudsql/PROJECT:REGION:INSTANCE" \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=PROJECT:REGION:INSTANCE" \
  --set-env-vars="NEXTAUTH_SECRET=your-secret" \
  --set-env-vars="NEXTAUTH_URL=https://yourdomain.com"
```

---

## Connection Pooling Setup

### 1. Configure PgBouncer (Optional)

File: `pgbouncer.ini`

```ini
[databases]
keyfate = host=/cloudsql/PROJECT:REGION:INSTANCE dbname=keyfate

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3
```

### 2. Application Pool Configuration

File: `src/lib/db.ts`

```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
});
```

---

## Security Configuration

### 1. SSL/TLS Configuration

```bash
# Download SSL certificates
gcloud sql ssl-certs create client-cert \
  --instance=keyfate-db-production

# Download certificate files
gcloud sql ssl-certs describe client-cert \
  --instance=keyfate-db-production \
  --format="get(cert)" > client-cert.pem
```

### 2. IAM Database Authentication

```bash
# Enable Cloud SQL IAM authentication
gcloud sql instances patch keyfate-db-production \
  --database-flags=cloudsql.iam_authentication=on

# Create IAM user
gcloud sql users create SERVICE_ACCOUNT@PROJECT.iam \
  --instance=keyfate-db-production \
  --type=cloud_iam_service_account
```

### 3. Network Security

```bash
# Use private IP for production
gcloud sql instances patch keyfate-db-production \
  --network=projects/PROJECT/global/networks/default \
  --no-assign-ip

# Configure VPC peering if needed
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default
```

---

## Data Migration

### 1. Export Data from Supabase

```bash
# Export data only (no schema)
pg_dump -h db.supabase.co \
  -U postgres \
  -d your_database \
  --data-only \
  --no-owner \
  --no-privileges \
  > supabase-data.sql
```

### 2. Transform Data (if needed)

```sql
-- Remove Supabase-specific data
-- Adjust any UUID or timestamp formats
-- Update any Supabase function calls
```

### 3. Import Data to Cloud SQL

```bash
# Start Cloud SQL Proxy
./cloud-sql-proxy PROJECT:REGION:INSTANCE &

# Import data
psql -h localhost -U keyfate_app -d keyfate < supabase-data.sql

# Verify data
psql -h localhost -U keyfate_app -d keyfate -c "SELECT COUNT(*) FROM users;"
```

### 4. Update Sequences

```sql
-- Update auto-increment sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('secrets_id_seq', (SELECT MAX(id) FROM secrets));
```

---

## Post-Migration Validation

### 1. Run Validation Script

```bash
# Validate all Cloud SQL components
ts-node scripts/validate-migration.ts
```

### 2. Run Test Suite

```bash
# Run migration validation tests
npm run test:migration
```

### 3. Manual Verification Checklist

- [ ] All tables exist with correct schema
- [ ] All indexes are created
- [ ] All foreign keys are set up
- [ ] Data counts match between databases
- [ ] Authorization layer working correctly
- [ ] Session validation functional
- [ ] API routes protected
- [ ] Server actions secured

### 4. Performance Testing

```bash
# Run load tests
npm run test:load

# Monitor query performance
psql -h localhost -U keyfate_app -d keyfate \
  -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

---

## Production Deployment

### 1. Update Cloud Run Configuration

```bash
# Add Cloud SQL connection
gcloud run services update YOUR_SERVICE \
  --add-cloudsql-instances=PROJECT:REGION:INSTANCE \
  --set-env-vars="DATABASE_URL=postgresql://keyfate_app:PASSWORD@/keyfate?host=/cloudsql/PROJECT:REGION:INSTANCE"
```

### 2. Deploy Application

```bash
# Build and deploy
npm run build
gcloud run deploy YOUR_SERVICE \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### 3. Verify Production

```bash
# Test production endpoint
curl https://yourdomain.com/api/health

# Monitor logs
gcloud run services logs read YOUR_SERVICE --limit=50
```

### 4. Set up Monitoring

```bash
# Create monitoring dashboard
gcloud monitoring dashboards create \
  --config-from-file=monitoring-config.yaml

# Set up alerts
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL \
  --display-name="Cloud SQL Connection Errors" \
  --condition-display-name="Connection failures" \
  --condition-threshold-value=5 \
  --condition-threshold-duration=60s
```

---

## Rollback Procedures

If migration fails, see [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) for detailed rollback instructions.

## Troubleshooting

For common issues and solutions, see [MIGRATION_TROUBLESHOOTING.md](./MIGRATION_TROUBLESHOOTING.md).

---

## Success Criteria

✅ Migration is successful when:

1. All validation tests pass
2. Application runs without errors
3. All authorization checks work correctly
4. Performance meets requirements (<100ms query times)
5. Security configuration verified
6. Monitoring and logging operational
7. Backup and recovery tested

---

## Next Steps

After successful migration:

1. Monitor application performance
2. Review and optimize slow queries
3. Set up regular backups
4. Configure disaster recovery
5. Document lessons learned
6. Train team on new infrastructure

---

## Support

For issues or questions:
- Check [MIGRATION_TROUBLESHOOTING.md](./MIGRATION_TROUBLESHOOTING.md)
- Review [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md)
- Contact DevOps team
- Consult Cloud SQL documentation
