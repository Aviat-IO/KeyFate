#!/bin/bash

# Production Deployment Script
# Deploys the application to production environment

set -e

echo "🚀 Starting deployment to production environment..."
echo "⚠️  WARNING: This is a PRODUCTION deployment!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Check required environment variables
if [ -z "$PRODUCTION_DATABASE_URL" ]; then
  echo "❌ Error: PRODUCTION_DATABASE_URL environment variable is required"
  exit 1
fi

if [ -z "$PRODUCTION_DEPLOYMENT_TARGET" ]; then
  echo "❌ Error: PRODUCTION_DEPLOYMENT_TARGET environment variable is required"
  exit 1
fi

echo "📋 Production Deployment Configuration:"
echo "   Target: $PRODUCTION_DEPLOYMENT_TARGET"
echo "   Database: ${PRODUCTION_DATABASE_URL:0:20}..."
echo ""

# Step 1: Run tests
echo "🧪 Running tests before production deployment..."
cd frontend
npm test
echo "✅ All tests passed"

# Step 2: Build frontend for production
echo "🔨 Building frontend for production..."
npm run build
echo "✅ Production build complete"

# Step 3: Backup production database
echo "💾 Creating database backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
pg_dump "$PRODUCTION_DATABASE_URL" > "backup_${timestamp}.sql"
echo "✅ Database backup created: backup_${timestamp}.sql"

# Step 4: Run database migrations on production
echo "📊 Running database migrations on production..."
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run db:migrate
echo "✅ Production database migrations complete"

# Step 5: Deploy based on target type
echo "🚀 Deploying to production..."

if [[ $PRODUCTION_DEPLOYMENT_TARGET == *"@"* ]]; then
  # SSH deployment
  echo "📡 Deploying via SSH..."
  rsync -avz --exclude node_modules --exclude .git . "$PRODUCTION_DEPLOYMENT_TARGET:/app/"
  ssh "$PRODUCTION_DEPLOYMENT_TARGET" "cd /app && npm install --production && pm2 restart all"
elif [[ $PRODUCTION_DEPLOYMENT_TARGET == *"docker"* ]]; then
  # Docker deployment
  echo "🐳 Deploying via Docker..."
  docker context use "$PRODUCTION_DEPLOYMENT_TARGET"
  docker-compose -f docker-compose.production.yml up -d --build
else
  echo "❌ Unknown deployment target type: $PRODUCTION_DEPLOYMENT_TARGET"
  exit 1
fi

echo "✅ Production deployment complete!"
echo ""
echo "🌐 Production environment should be available at:"
echo "   ${PRODUCTION_URL:-https://your-domain.com}"
echo ""
echo "🔍 To verify deployment:"
echo "   curl ${PRODUCTION_URL:-https://your-domain.com}/api/health"
echo ""
echo "💾 Database backup available at: backup_${timestamp}.sql"