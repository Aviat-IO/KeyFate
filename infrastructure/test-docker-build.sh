#!/bin/bash
# Test script to verify Docker build works with the correct path

set -e

# Get the absolute path to the frontend directory
FRONTEND_DIR="$(realpath "$(dirname "$0")/../../frontend")"

echo "Testing Docker build with frontend directory: $FRONTEND_DIR"

# Test that the Dockerfile exists
if [ ! -f "$FRONTEND_DIR/Dockerfile" ]; then
  echo "ERROR: Dockerfile not found at $FRONTEND_DIR/Dockerfile"
  exit 1
fi

echo "✓ Dockerfile found"

# Test the Docker build command (same as what Terraform will use)
echo "Testing Docker build command with required build args..."
docker build \
  --platform linux/amd64 \
  --build-arg BUILD_ENV=staging \
  --build-arg NEXT_PUBLIC_SITE_URL="https://staging.keyfate.com" \
  --build-arg NEXT_PUBLIC_COMPANY="KeyFate" \
  --build-arg NEXT_PUBLIC_PARENT_COMPANY="KeyFate Inc" \
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL="support@aviat.io" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="" \
  --build-arg NEXT_PUBLIC_AUTH_PROVIDER="google" \
  --build-arg NEXT_PUBLIC_DATABASE_PROVIDER="cloudsql" \
  --build-arg NEXT_PUBLIC_ENV="staging" \
  -t test-keyfate-frontend:test \
  -f "$FRONTEND_DIR/Dockerfile" \
  "$FRONTEND_DIR"

echo "✅ Docker build test completed successfully!"
echo ""
echo "The fix should now work with terragrunt apply."
echo "The key changes made:"
echo "1. Added 'frontend_dir' variable to variables.tf"
echo "2. Updated frontend.tf to use the variable if provided"
echo "3. Updated terragrunt.hcl files to pass the absolute path to frontend directory"

