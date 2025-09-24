#!/bin/bash

# Staging Deployment Script
# Deploys the application to staging environment

set -e

echo "🚀 Starting deployment to staging environment..."

# Check required environment variables
if [ -z "$STAGING_DATABASE_URL" ]; then
  echo "❌ Error: STAGING_DATABASE_URL environment variable is required"
  exit 1
fi

if [ -z "$STAGING_DEPLOYMENT_TARGET" ]; then
  echo "❌ Error: STAGING_DEPLOYMENT_TARGET environment variable is required"
  echo "   Example: user@staging-server.com or staging-docker-context"
  exit 1
fi

echo "📋 Deployment Configuration:"
echo "   Target: $STAGING_DEPLOYMENT_TARGET"
echo "   Database: ${STAGING_DATABASE_URL:0:20}..."
echo ""

# Step 1: Build frontend
echo "🔨 Building frontend for staging..."
cd frontend
npm run build
echo "✅ Frontend build complete"

# Step 2: Run database migrations on staging
echo "📊 Running database migrations on staging..."
DATABASE_URL="$STAGING_DATABASE_URL" npm run db:migrate
echo "✅ Staging database migrations complete"

# Step 3: Deploy based on target type
echo "🚀 Deploying to staging..."

if [[ $STAGING_DEPLOYMENT_TARGET == *"@"* ]]; then
  # SSH deployment
  echo "📡 Deploying via SSH..."
  rsync -avz --exclude node_modules --exclude .git . "$STAGING_DEPLOYMENT_TARGET:/app/"
  ssh "$STAGING_DEPLOYMENT_TARGET" "cd /app && npm install --production && pm2 restart all"
elif [[ $STAGING_DEPLOYMENT_TARGET == *"docker"* ]]; then
  # Docker deployment
  echo "🐳 Deploying via Docker..."
  docker context use "$STAGING_DEPLOYMENT_TARGET"
  docker-compose -f docker-compose.staging.yml up -d --build
else
  echo "❌ Unknown deployment target type: $STAGING_DEPLOYMENT_TARGET"
  exit 1
fi

echo "✅ Staging deployment complete!"
echo ""
echo "🌐 Staging environment should be available at:"
echo "   ${STAGING_URL:-https://staging.your-domain.com}"
echo ""
echo "🔍 To verify deployment:"
echo "   curl ${STAGING_URL:-https://staging.your-domain.com}/api/health"