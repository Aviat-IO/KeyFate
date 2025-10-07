# Cloud SQL Migration Troubleshooting Guide

## Common Issues and Solutions for Cloud SQL Migration

This guide covers common issues encountered during the Supabase to Cloud SQL migration and their solutions.

---

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Schema Migration Errors](#schema-migration-errors)
3. [Performance Issues](#performance-issues)
4. [Security and SSL Problems](#security-and-ssl-problems)
5. [Authorization Layer Issues](#authorization-layer-issues)
6. [Data Migration Issues](#data-migration-issues)
7. [Deployment Issues](#deployment-issues)
8. [Monitoring and Logging](#monitoring-and-logging)

---

## Connection Issues

### Issue 1: Unable to Connect to Cloud SQL Instance

**Symptoms**:
```
Error: connect ETIMEDOUT
Error: Connection refused
```

**Diagnosis**:
```bash
# Check instance status
gcloud sql instances describe keyfate-db-production

# Check network configuration
gcloud sql instances describe keyfate-db-production \
  --format="get(ipAddresses)"
```

**Solutions**:

1. **Check instance is running**:
```bash
gcloud sql instances list
# Instance should show "RUNNABLE" status
```

2. **Verify authorized networks**:
```bash
# Add your IP to authorized networks
gcloud sql instances patch keyfate-db-production \
  --authorized-networks=YOUR_IP_ADDRESS
```

3. **Use Cloud SQL Proxy**:
```bash
# Download and run proxy
./cloud-sql-proxy PROJECT:REGION:INSTANCE
# Connect via localhost:5432
```

4. **Check firewall rules**:
```bash
gcloud compute firewall-rules list --filter="name~cloud-sql"
```

---

### Issue 2: Cloud SQL Proxy Connection Failures

**Symptoms**:
```
Error: failed to refresh token: oauth2: cannot fetch token
Error: Post "https://sqladmin.googleapis.com/...": dial tcp: lookup sqladmin.googleapis.com
```

**Diagnosis**:
```bash
# Check proxy logs
./cloud-sql-proxy PROJECT:REGION:INSTANCE --verbose

# Verify credentials
gcloud auth list
gcloud auth application-default print-access-token
```

**Solutions**:

1. **Authenticate properly**:
```bash
gcloud auth login
gcloud auth application-default login
```

2. **Use correct instance name**:
```bash
# Format: PROJECT:REGION:INSTANCE
./cloud-sql-proxy your-project:us-central1:keyfate-db-production
```

3. **Check IAM permissions**:
```bash
# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/cloudsql.client"
```

4. **Use service account credentials**:
```bash
./cloud-sql-proxy PROJECT:REGION:INSTANCE \
  --credentials-file=/path/to/service-account-key.json
```

---

### Issue 3: Connection Pooling Problems

**Symptoms**:
```
Error: too many clients already
Error: remaining connection slots are reserved
```

**Diagnosis**:
```bash
# Check current connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity"

# Check max connections
psql $DATABASE_URL -c "SHOW max_connections"
```

**Solutions**:

1. **Increase max connections**:
```bash
gcloud sql instances patch keyfate-db-production \
  --database-flags=max_connections=100
```

2. **Configure connection pool**:
```typescript
// src/lib/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Limit pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

3. **Use PgBouncer**:
```ini
# pgbouncer.ini
[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

4. **Close idle connections**:
```sql
-- Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '5 minutes';
```

---

## Schema Migration Errors

### Issue 4: Migration Scripts Failing

**Symptoms**:
```
Error: relation "drizzle.__drizzle_migrations" does not exist
Error: column "created_at" of relation "users" does not exist
```

**Diagnosis**:
```bash
# Check migration status
npx drizzle-kit check

# List applied migrations
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations"
```

**Solutions**:

1. **Create migration schema**:
```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
```

2. **Reset migrations** (CAUTION):
```bash
# Only for development!
npx drizzle-kit drop
npx drizzle-kit push
```

3. **Fix migration order**:
```bash
# Generate new migration
npx drizzle-kit generate

# Apply specific migration
npx drizzle-kit migrate --to=20240101000000
```

4. **Manual migration repair**:
```sql
-- Add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create missing indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
```

---

### Issue 5: Foreign Key Constraint Failures

**Symptoms**:
```
Error: insert or update on table "secrets" violates foreign key constraint
Error: foreign key constraint "secrets_user_id_fkey" cannot be implemented
```

**Diagnosis**:
```bash
# Check foreign keys
psql $DATABASE_URL << EOF
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
EOF
```

**Solutions**:

1. **Ensure referenced data exists**:
```sql
-- Check for orphaned records
SELECT s.*
FROM secrets s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;
```

2. **Drop and recreate constraints**:
```sql
-- Drop constraint
ALTER TABLE secrets DROP CONSTRAINT IF EXISTS secrets_user_id_fkey;

-- Recreate with proper reference
ALTER TABLE secrets
ADD CONSTRAINT secrets_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

3. **Disable constraints temporarily** (migration only):
```sql
-- Disable
ALTER TABLE secrets DISABLE TRIGGER ALL;

-- Re-enable after data import
ALTER TABLE secrets ENABLE TRIGGER ALL;
```

---

## Performance Issues

### Issue 6: Slow Query Performance

**Symptoms**:
```
Queries taking >1 second
Timeout errors
High CPU usage
```

**Diagnosis**:
```bash
# Enable query logging
gcloud sql instances patch keyfate-db-production \
  --database-flags=log_min_duration_statement=100

# Check slow queries
psql $DATABASE_URL << EOF
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
EOF

# Analyze specific query
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM secrets WHERE user_id = 'test'"
```

**Solutions**:

1. **Add missing indexes**:
```sql
-- Create indexes on foreign keys
CREATE INDEX IF NOT EXISTS secrets_user_id_idx ON secrets(user_id);
CREATE INDEX IF NOT EXISTS recipients_secret_id_idx ON recipients(secret_id);

-- Create composite indexes
CREATE INDEX IF NOT EXISTS secrets_user_status_idx
  ON secrets(user_id, status);
```

2. **Optimize queries**:
```sql
-- Before: N+1 query
SELECT * FROM secrets;
-- Then for each: SELECT * FROM recipients WHERE secret_id = ?

-- After: Single query with JOIN
SELECT s.*, r.*
FROM secrets s
LEFT JOIN recipients r ON s.id = r.secret_id
WHERE s.user_id = 'user-id';
```

3. **Increase instance resources**:
```bash
# Upgrade instance tier
gcloud sql instances patch keyfate-db-production \
  --tier=db-custom-4-16384
```

4. **Implement query caching**:
```typescript
import { unstable_cache } from 'next/cache';

export const getSecrets = unstable_cache(
  async (userId: string) => {
    return await db.select()
      .from(secrets)
      .where(eq(secrets.userId, userId));
  },
  ['user-secrets'],
  { revalidate: 60 }
);
```

---

### Issue 7: Connection Pool Exhaustion

**Symptoms**:
```
Error: sorry, too many clients already
Error: timeout acquiring connection from pool
```

**Diagnosis**:
```bash
# Check active connections
psql $DATABASE_URL << EOF
SELECT
  count(*),
  state,
  wait_event_type
FROM pg_stat_activity
GROUP BY state, wait_event_type;
EOF
```

**Solutions**:

1. **Increase pool size**:
```typescript
const pool = new Pool({
  max: 30, // Increase from 20
  idleTimeoutMillis: 10000, // Close idle faster
});
```

2. **Use transaction pooling**:
```ini
# pgbouncer.ini
pool_mode = transaction  # More efficient than session
max_client_conn = 1000
default_pool_size = 25
```

3. **Close connections properly**:
```typescript
// Always release connections
const client = await pool.connect();
try {
  await client.query('...');
} finally {
  client.release();
}
```

4. **Monitor and kill long-running queries**:
```sql
-- Kill queries running > 5 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
AND now() - query_start > interval '5 minutes';
```

---

## Security and SSL Problems

### Issue 8: SSL Connection Failures

**Symptoms**:
```
Error: SSL is not enabled on the server
Error: certificate verify failed
```

**Diagnosis**:
```bash
# Check SSL status
psql $DATABASE_URL -c "SHOW ssl"

# Test SSL connection
psql "postgresql://user:pass@host/db?sslmode=require"
```

**Solutions**:

1. **Enable SSL on instance**:
```bash
gcloud sql instances patch keyfate-db-production \
  --require-ssl
```

2. **Configure SSL in connection string**:
```bash
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
# Or for self-signed certs:
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&sslrootcert=/path/to/ca.pem"
```

3. **Use Cloud SQL Proxy** (handles SSL automatically):
```bash
./cloud-sql-proxy PROJECT:REGION:INSTANCE
# Connect to localhost without SSL config
```

4. **Download and use SSL certificates**:
```bash
# Create client certificate
gcloud sql ssl-certs create client-cert \
  --instance=keyfate-db-production

# Get certificate
gcloud sql ssl-certs describe client-cert \
  --instance=keyfate-db-production \
  --format="get(cert)" > client-cert.pem

# Use in connection
psql "postgresql://user@host/db?sslmode=verify-full&sslcert=client-cert.pem"
```

---

### Issue 9: IAM Authentication Failures

**Symptoms**:
```
Error: FATAL: password authentication failed
Error: IAM authentication is not enabled
```

**Diagnosis**:
```bash
# Check IAM authentication status
gcloud sql instances describe keyfate-db-production \
  --format="get(settings.databaseFlags)"
```

**Solutions**:

1. **Enable IAM authentication**:
```bash
gcloud sql instances patch keyfate-db-production \
  --database-flags=cloudsql.iam_authentication=on
```

2. **Create IAM database user**:
```bash
gcloud sql users create SERVICE_ACCOUNT@PROJECT.iam \
  --instance=keyfate-db-production \
  --type=cloud_iam_service_account
```

3. **Grant database privileges**:
```sql
GRANT ALL PRIVILEGES ON DATABASE keyfate
TO "SERVICE_ACCOUNT@PROJECT.iam";
```

4. **Use IAM token in connection**:
```typescript
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth();
const client = await auth.getClient();
const token = await client.getAccessToken();

const pool = new Pool({
  host: '/cloudsql/PROJECT:REGION:INSTANCE',
  user: 'SERVICE_ACCOUNT@PROJECT.iam',
  password: token.token,
  database: 'keyfate',
});
```

---

## Authorization Layer Issues

### Issue 10: Session Validation Failures

**Symptoms**:
```
Error: Unauthorized - no session found
Error: Invalid session token
NextAuth session is null
```

**Diagnosis**:
```bash
# Check NextAuth configuration
echo $NEXTAUTH_URL
echo $NEXTAUTH_SECRET

# Test session endpoint
curl https://yourdomain.com/api/auth/session \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

**Solutions**:

1. **Verify NextAuth configuration**:
```typescript
// src/app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET, // Must be set!
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // ...
};
```

2. **Check environment variables**:
```bash
# .env.production.local
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secret-here # Use: openssl rand -base64 32
```

3. **Fix cookie configuration**:
```typescript
export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
```

4. **Debug session in middleware**:
```typescript
// src/middleware.ts
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  console.log('Session token:', token); // Debug

  if (!token) {
    console.log('No session found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}
```

---

### Issue 11: Unauthorized Access to Resources

**Symptoms**:
```
User can see other users' secrets
Authorization checks failing
No user ID in queries
```

**Diagnosis**:
```bash
# Check session structure
curl https://yourdomain.com/api/auth/session | jq

# Test API with different users
curl https://yourdomain.com/api/secrets \
  -H "Authorization: Bearer USER1_TOKEN"
```

**Solutions**:

1. **Always validate user ID from session**:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getSecrets() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // ALWAYS filter by user ID
  return await db
    .select()
    .from(secrets)
    .where(eq(secrets.userId, session.user.id));
}
```

2. **Implement ownership checks**:
```typescript
export async function requireOwnership(resourceUserId: string) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id !== resourceUserId) {
    throw new Error('Forbidden: You do not own this resource');
  }
}

// Usage
const secret = await getSecret(secretId);
await requireOwnership(secret.userId);
```

3. **Add authorization middleware**:
```typescript
// src/lib/auth-middleware.ts
export function withAuth<T>(
  handler: (userId: string, ...args: any[]) => Promise<T>
) {
  return async (...args: any[]): Promise<T> => {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    return handler(session.user.id, ...args);
  };
}

// Usage
export const getSecrets = withAuth(async (userId: string) => {
  return await db
    .select()
    .from(secrets)
    .where(eq(secrets.userId, userId));
});
```

4. **Test authorization thoroughly**:
```typescript
// __tests__/auth/authorization.test.ts
describe('Authorization', () => {
  it('should prevent access to other users secrets', async () => {
    const user1Token = await getAuthToken('user1@example.com');
    const user2Secret = await createSecret('user2@example.com');

    const response = await fetch(`/api/secrets/${user2Secret.id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    expect(response.status).toBe(403);
  });
});
```

---

## Data Migration Issues

### Issue 12: Data Type Mismatches

**Symptoms**:
```
Error: column "created_at" is of type timestamp without time zone
Error: invalid input syntax for type uuid
```

**Solutions**:

1. **Convert timestamps**:
```sql
-- Supabase uses timestamptz, ensure compatibility
ALTER TABLE users
  ALTER COLUMN created_at TYPE timestamp with time zone;
```

2. **Handle UUID vs String IDs**:
```sql
-- Convert string IDs to UUID
ALTER TABLE users
  ALTER COLUMN id TYPE uuid USING id::uuid;
```

3. **Transform data during import**:
```typescript
// Transform before insert
const transformedData = supabaseData.map(row => ({
  ...row,
  id: row.id, // Already UUID
  createdAt: new Date(row.created_at), // Convert to Date
}));
```

---

### Issue 13: Missing or Duplicate Data

**Symptoms**:
```
Record count mismatch between databases
Duplicate key violations
Missing foreign key references
```

**Diagnosis**:
```bash
# Compare record counts
psql $SUPABASE_URL -c "SELECT COUNT(*) FROM secrets"
psql $CLOUD_SQL_URL -c "SELECT COUNT(*) FROM secrets"

# Find duplicates
psql $CLOUD_SQL_URL << EOF
SELECT id, COUNT(*)
FROM secrets
GROUP BY id
HAVING COUNT(*) > 1;
EOF
```

**Solutions**:

1. **Use transaction for migration**:
```sql
BEGIN;

-- Import data
\copy secrets FROM 'secrets.csv' WITH CSV HEADER;

-- Verify counts
SELECT COUNT(*) FROM secrets;

-- If correct:
COMMIT;
-- If wrong:
ROLLBACK;
```

2. **Handle duplicates**:
```sql
-- Remove duplicates (keep newest)
DELETE FROM secrets a
USING secrets b
WHERE a.id = b.id
AND a.created_at < b.created_at;
```

3. **Fix orphaned records**:
```sql
-- Delete orphaned secrets
DELETE FROM secrets s
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = s.user_id
);
```

---

## Deployment Issues

### Issue 14: Cloud Run Environment Variables

**Symptoms**:
```
Error: DATABASE_URL is undefined
Error: NEXTAUTH_SECRET is not set
```

**Solutions**:

1. **Set all required environment variables**:
```bash
gcloud run services update YOUR_SERVICE \
  --set-env-vars="DATABASE_URL=postgresql://..." \
  --set-env-vars="NEXTAUTH_SECRET=..." \
  --set-env-vars="NEXTAUTH_URL=https://yourdomain.com"
```

2. **Use Secret Manager for sensitive data**:
```bash
# Create secret
echo -n "postgresql://..." | gcloud secrets create database-url --data-file=-

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Use in Cloud Run
gcloud run services update YOUR_SERVICE \
  --update-secrets="DATABASE_URL=database-url:latest"
```

---

### Issue 15: Cold Start Connection Issues

**Symptoms**:
```
First request after idle period fails
Timeout on initial connection
```

**Solutions**:

1. **Implement connection warming**:
```typescript
// src/lib/db.ts
let isWarmed = false;

export async function warmConnection() {
  if (!isWarmed) {
    await pool.query('SELECT 1');
    isWarmed = true;
  }
}

// Call in middleware or API routes
await warmConnection();
```

2. **Configure Cloud Run min instances**:
```bash
gcloud run services update YOUR_SERVICE \
  --min-instances=1
```

3. **Use connection pooler**:
```bash
# PgBouncer stays connected
# Application connects to pooler instead
```

---

## Monitoring and Logging

### Issue 16: Missing Query Logs

**Symptoms**:
```
No slow query logs
Unable to debug performance issues
```

**Solutions**:

1. **Enable query logging**:
```bash
gcloud sql instances patch keyfate-db-production \
  --database-flags=log_statement=all,log_min_duration_statement=100
```

2. **View logs**:
```bash
# Cloud SQL logs
gcloud sql operations list --instance=keyfate-db-production

# Application logs
gcloud run services logs read YOUR_SERVICE --limit=100
```

3. **Install pg_stat_statements**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Getting Additional Help

### Diagnostic Information to Collect

```bash
# System information
gcloud sql instances describe keyfate-db-production > instance-info.yaml
gcloud run services describe YOUR_SERVICE > service-info.yaml

# Database state
psql $DATABASE_URL << EOF > db-state.txt
SELECT version();
SELECT current_database(), current_user;
SHOW all;
SELECT * FROM pg_stat_activity;
SELECT * FROM pg_stat_database;
\dt
\di
\l
EOF

# Recent logs
gcloud sql operations list --instance=keyfate-db-production --limit=20 > sql-operations.log
gcloud run services logs read YOUR_SERVICE --limit=100 > app-logs.log
```

### Support Resources

- **Google Cloud SQL Documentation**: https://cloud.google.com/sql/docs
- **Cloud SQL Known Issues**: https://cloud.google.com/sql/docs/postgres/known-issues
- **Stack Overflow**: Tag with `google-cloud-sql` and `postgresql`
- **Google Cloud Support**: https://cloud.google.com/support

### Emergency Rollback

If issues cannot be resolved quickly, see [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) for emergency rollback instructions.
