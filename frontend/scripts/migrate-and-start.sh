#!/bin/bash
set -e

echo "🗄️  Starting database migration..."

# Cloud Run Gen 1 creates the /cloudsql socket automatically via annotation
# Give it a few seconds to initialize
echo "⏳ Waiting 10s for Cloud SQL proxy to initialize..."
sleep 10

# Run migrations with retries (network issues, proxy not ready, etc.)
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  echo "Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES: Running database migrations..."
  if npm run db:migrate:prod; then
    echo "✅ Database migrations completed successfully"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      WAIT_TIME=$((5 + RETRY_COUNT * 2))
      echo "⚠️  Migration attempt $RETRY_COUNT failed, retrying in ${WAIT_TIME}s..."
      sleep $WAIT_TIME
    else
      echo "❌ Database migration failed after $MAX_RETRIES attempts"
      exit 1
    fi
  fi
done

echo "🚀 Starting Next.js server..."

# Start the Next.js standalone server
# In standalone mode, Next.js creates a server.js file that should be used directly
# This avoids running npm start which tries to validate env vars with scripts that may not exist in standalone
exec node server.js
