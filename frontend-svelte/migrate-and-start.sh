#!/bin/bash
set -e

MAX_RETRIES=3
RETRY_DELAY=5

echo "Running database migrations..."
for i in $(seq 1 $MAX_RETRIES); do
  echo "Migration attempt $i/$MAX_RETRIES..."
  if bunx drizzle-kit migrate; then
    echo "Migrations completed successfully."
    break
  fi

  if [ "$i" -eq "$MAX_RETRIES" ]; then
    echo "Migrations failed after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi

  echo "Migration failed, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done

echo "Starting application..."
exec bun run build/index.js
