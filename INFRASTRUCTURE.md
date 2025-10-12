# Local Development Infrastructure

This project provides a complete local development infrastructure that migrates away from Supabase to a local PostgreSQL setup while maintaining ease of use and deployment capabilities.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Git

### Setup Commands

```bash
# 1. Complete environment setup
make install

# 2. Start local development
make dev

# 3. Access your application
open http://localhost:3000
```

## Available Commands

### Development Commands

```bash
make install          # Complete local environment setup
make dev              # Start full local development stack
make stop             # Stop all local services
make clean            # Clean up containers and volumes
make status           # Show status of all services
```

### Database Commands

```bash
make migrate          # Run database migrations
make seed             # Seed database with development data
make reset-db         # Reset database (migrate + seed)
make test             # Run infrastructure tests
```

### Deployment Commands

```bash
make deploy-staging   # Deploy to staging environment
make deploy-prod      # Deploy to production environment
```

## Architecture

### Local Services

- **PostgreSQL 16**: Primary database server
- **Redis 7**: Caching and session storage (optional)
- **PgAdmin**: Database administration tool (optional)
- **NextJS**: Frontend development server

### Directory Structure

```
project/
├── Makefile                    # Main orchestration commands
├── docker-compose.yml          # Local services configuration
├── package.json               # Root project dependencies
├── .env.local.example         # Environment template
├── database/
│   ├── init/                  # Database initialization scripts
│   ├── migrations/            # Database migration files
│   └── seeds/                 # Database seed data
├── scripts/
│   ├── migrate.js             # Migration runner
│   ├── seed-local-db.js       # Local database seeding
│   ├── test-db-connection.js  # Connection testing
│   ├── deploy-staging.sh      # Staging deployment
│   └── deploy-prod.sh         # Production deployment
├── deploy/                    # Deployment configurations
└── frontend/                  # NextJS application
    ├── src/lib/db/           # Database schema and configuration
    └── drizzle/              # Generated migration files
```

## Environment Configuration

### Local Development

1. Copy environment template:

   ```bash
   cp .env.local.example .env.local
   cp frontend/.env.local.example frontend/.env.local
   ```

2. Configure your settings in `.env.local`:

   ```bash
   # Database Configuration
   POSTGRES_DB=keyfate_dev
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=dev_password_change_in_prod

   # Application Secrets
   ENCRYPTION_KEY=your-encryption-key
   JWT_SECRET=your-jwt-secret

   # Email Configuration (optional for local)
   SENDGRID_API_KEY=your-sendgrid-api-key
   ```

### Staging/Production

Set these environment variables for deployment:

```bash
# Staging
export STAGING_DATABASE_URL="postgresql://user:pass@staging-db/dbname"
export STAGING_DEPLOYMENT_TARGET="user@staging-server.com"
export STAGING_URL="https://staging.your-domain.com"

# Production
export PRODUCTION_DATABASE_URL="postgresql://user:pass@prod-db/dbname"
export PRODUCTION_DEPLOYMENT_TARGET="user@prod-server.com"
export PRODUCTION_URL="https://your-domain.com"
```

## Database Management

### Migrations

The project uses Drizzle ORM for database management:

```bash
# Generate new migration
cd frontend && npm run db:generate

# Apply migrations to local database
make migrate

# Apply migrations to staging/production
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate
```

### Schema Management

- Database schema is defined in `frontend/src/lib/db/schema.ts`
- Drizzle configuration is in `frontend/drizzle.config.ts`
- Migration files are generated in `frontend/drizzle/`

### Development Data

```bash
# Seed local database with development data
make seed

# Reset database completely
make reset-db
```

Development users created by seeding:

- `dev@localhost` / `password123` (Free tier)
- `test@localhost` / `password123` (Pro tier)

## Services

### PostgreSQL Database

- **Host**: localhost
- **Port**: 5432
- **Database**: keyfate_dev
- **User**: postgres
- **Password**: dev_password_change_in_prod

### Redis Cache (Optional)

- **Host**: localhost
- **Port**: 6379
- **No authentication in development**

### PgAdmin (Optional)

- **URL**: <http://localhost:5050>
- **Email**: <admin@local.dev>
- **Password**: admin

To enable PgAdmin:

```bash
# Add to .env.local
ENABLE_PGADMIN=true

# Start with admin profile
docker-compose --profile admin up -d
```

## Testing

### Infrastructure Tests

```bash
# Run all infrastructure tests
make test

# Test database connection only
node scripts/test-db-connection.js
```

### Application Tests

```bash
# Frontend tests
cd frontend && npm test
```

## Deployment

### Staging Deployment

```bash
# Set staging environment variables
export STAGING_DATABASE_URL="..."
export STAGING_DEPLOYMENT_TARGET="..."

# Deploy to staging
make deploy-staging
```

### Production Deployment

```bash
# Set production environment variables
export PRODUCTION_DATABASE_URL="..."
export PRODUCTION_DEPLOYMENT_TARGET="..."

# Deploy to production (includes confirmation prompt)
make deploy-prod
```

## Troubleshooting

### Database Connection Issues

```bash
# Check service status
make status

# Check database logs
docker-compose logs postgres

# Test database connection
node scripts/test-db-connection.js

# Restart services
make stop && make dev
```

### Port Conflicts

If you have port conflicts, update `.env.local`:

```bash
# Change default ports
POSTGRES_PORT=5433
REDIS_PORT=6380
PGADMIN_PORT=5051
```

### Migration Issues

```bash
# Reset database completely
make clean
make install
make reset-db
```

### Frontend Issues

```bash
# Restart frontend with fresh dependencies
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

## Migration from Supabase

This infrastructure replaces Supabase with local PostgreSQL while maintaining:

- ✅ Database schema compatibility
- ✅ Authentication patterns
- ✅ Environment variable structure
- ✅ Migration and seeding workflows
- ✅ Deployment automation

Key differences from Supabase:

- Local PostgreSQL instead of hosted Supabase
- Drizzle ORM instead of Supabase client
- Local authentication instead of Supabase Auth
- Docker Compose for local services
- Simplified deployment scripts

## Security Considerations

### Development

- Default passwords are for development only
- HTTPS not required for local development
- Debug mode enabled by default

### Production

- Change all default passwords
- Use strong, unique secrets
- Enable HTTPS/TLS
- Implement proper backup strategy
- Monitor logs and metrics
- Use environment-specific secrets management

## Performance Optimization

### Local Development

- Database optimized for development speed
- Hot reloading enabled
- Debug logging enabled

### Production

- Production-optimized database configuration
- Connection pooling enabled
- Caching strategies implemented
- Asset optimization and CDN integration

