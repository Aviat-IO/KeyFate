#!/bin/bash
set -e

echo "🔥 Resetting Staging Database"
echo "=============================="
echo ""
echo "⚠️  This will DROP and RECREATE the database!"
echo ""
read -p "Are you sure? Type 'yes' to continue: " -r
if [[ ! $REPLY == "yes" ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Connecting to Cloud SQL via gcloud..."

# Drop and recreate database
gcloud sql databases delete keyfate \
  --instance=keyfate-postgres-staging \
  --project=keyfate-dev \
  --quiet 2>/dev/null || echo "Database doesn't exist or already deleted"

echo "Creating fresh database..."
gcloud sql databases create keyfate \
  --instance=keyfate-postgres-staging \
  --project=keyfate-dev

echo ""
echo "✅ Database reset complete!"
echo ""
echo "Next steps:"
echo "1. Start bastion tunnel:"
echo "   gcloud compute ssh bastion-host --zone=us-central1-a --project=keyfate-dev \\"
echo "     --tunnel-through-iap \\"
echo "     --ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'"
echo ""
echo "2. Run migrations:"
echo "   npm run db:migrate -- --config=drizzle-staging.config.ts"
echo ""
