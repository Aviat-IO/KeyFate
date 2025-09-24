# Cloud SQL Migration Plan

## Current State Analysis
- **Database**: Supabase PostgreSQL
- **ORM**: Drizzle ORM (installed but no config found)
- **Schema**: Complex schema with secrets, admin_notifications, etc.
- **Environment**: Next.js app with server actions

## Cloud SQL Implementation Steps

### Phase 1: Infrastructure Setup (Task 2.1)
1. **Create Cloud SQL PostgreSQL instance**
   - Instance name: `keyfate-db-production`
   - Database: PostgreSQL 15
   - Machine type: `db-f1-micro` (dev) / `db-custom-2-8192` (prod)
   - Storage: 20GB SSD (auto-increase enabled)
   - Region: `us-central1` (or closest to app)
   - High availability: Enabled for production

2. **Security Configuration**
   - Enable SSL/TLS encryption
   - Configure authorized networks
   - Set up Cloud SQL Proxy for secure connections
   - Create database user with limited privileges

### Phase 2: Authentication & Security (Task 2.2)
1. **Database User Setup**
   - Create application-specific user
   - Grant minimal required permissions
   - Set up connection pooling user

2. **Connection Security**
   - Configure SSL certificates
   - Set up Cloud SQL Auth Proxy
   - Enable private IP for production

### Phase 3: Connection Pooling (Task 2.3)
1. **PgBouncer Setup**
   - Configure connection pooling
   - Optimize pool size for app requirements
   - Set up monitoring for pool health

## Implementation Commands

### 1. Create Cloud SQL Instance
```bash
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
  --maintenance-window-hour=04
```

### 2. Create Database and User
```bash
# Create database
gcloud sql databases create keyfate \
  --instance=keyfate-db-production

# Create application user
gcloud sql users create keyfate_app \
  --instance=keyfate-db-production \
  --password=[SECURE_PASSWORD]
```

### 3. Configure Drizzle
- Create `drizzle.config.ts`
- Set up schema files
- Configure migrations
- Update database connection code

## Environment Variables Required
```
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
CLOUD_SQL_CONNECTION_NAME=project:region:instance
```

## Testing Strategy
1. Connection validation
2. Schema migration testing
3. Performance benchmarking
4. SSL/Security validation
5. Connection pool testing