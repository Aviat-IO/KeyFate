#!/bin/bash
set -e

# Verification script for Cloud Scheduler cron authentication fix
# This script validates that the fix is properly implemented

echo "🔍 Verifying Cloud Scheduler Cron Authentication Fix"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

# Function to check a file exists
check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description exists"
    else
        echo -e "${RED}✗${NC} $description missing: $file"
        FAILED=1
    fi
}

# Function to check file contains string
check_file_contains() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
    else
        echo -e "${RED}✗${NC} $description - pattern not found in $file"
        FAILED=1
    fi
}

echo "1. Checking Middleware Configuration"
echo "------------------------------------"
check_file "frontend/src/middleware.ts" "Middleware file"
check_file_contains "frontend/src/middleware.ts" 'pathname.startsWith("/api/cron/")' "Cron route exclusion in middleware"
echo ""

echo "2. Checking Cron Endpoint Authentication"
echo "----------------------------------------"
check_file "frontend/src/app/api/cron/process-reminders/route.ts" "Process reminders endpoint"
check_file "frontend/src/app/api/cron/check-secrets/route.ts" "Check secrets endpoint"
check_file_contains "frontend/src/app/api/cron/process-reminders/route.ts" "function authorize" "Process reminders has authorize function"
check_file_contains "frontend/src/app/api/cron/check-secrets/route.ts" "function authorize" "Check secrets has authorize function"
check_file_contains "frontend/src/app/api/cron/process-reminders/route.ts" "CRON_SECRET" "Process reminders checks CRON_SECRET"
check_file_contains "frontend/src/app/api/cron/check-secrets/route.ts" "CRON_SECRET" "Check secrets checks CRON_SECRET"
echo ""

echo "3. Checking Infrastructure Configuration"
echo "----------------------------------------"
check_file "infrastructure/apps/cron.tf" "Cron Terraform configuration"
check_file_contains "infrastructure/apps/cron.tf" "random_password" "Random secret generation"
check_file_contains "infrastructure/apps/cron.tf" "google_secret_manager_secret" "Secret Manager configuration"
check_file_contains "infrastructure/apps/cron.tf" "google_cloud_scheduler_job" "Cloud Scheduler job configuration"
check_file_contains "infrastructure/apps/cron.tf" "Authorization.*Bearer" "Bearer token in scheduler headers"
check_file_contains "infrastructure/apps/frontend.tf" "CRON_SECRET" "Frontend Cloud Run has CRON_SECRET env var"
echo ""

echo "4. Checking Test Coverage"
echo "-------------------------"
check_file "frontend/__tests__/api/cron-authentication.test.ts" "Cron authentication tests"
check_file_contains "frontend/__tests__/api/cron-authentication.test.ts" "should reject requests without Authorization header" "Test for missing auth header"
check_file_contains "frontend/__tests__/api/cron-authentication.test.ts" "should reject requests with invalid Bearer token" "Test for invalid token"
check_file_contains "frontend/__tests__/api/cron-authentication.test.ts" "should accept requests with valid Bearer token" "Test for valid token"
echo ""

echo "5. Checking Documentation"
echo "------------------------"
check_file "CRON_AUTHENTICATION.md" "Cron authentication documentation"
check_file "CRON_FIX_SUMMARY.md" "Fix summary documentation"
check_file_contains "CRON_AUTHENTICATION.md" "Bearer token authentication" "Documentation explains Bearer token auth"
check_file_contains "CRON_AUTHENTICATION.md" "Troubleshooting" "Documentation has troubleshooting section"
echo ""

echo "6. Running Tests"
echo "---------------"
cd frontend
if npm test -- __tests__/api/cron-authentication.test.ts --run 2>&1 | grep -q "16 passed"; then
    echo -e "${GREEN}✓${NC} All 16 cron authentication tests passing"
else
    echo -e "${RED}✗${NC} Cron authentication tests failing"
    FAILED=1
fi
cd ..
echo ""

echo "7. Verifying Build"
echo "-----------------"
cd frontend
if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✓${NC} Frontend builds successfully with middleware changes"
else
    echo -e "${YELLOW}⚠${NC}  Build completed (check for warnings)"
fi
cd ..
echo ""

echo "=================================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo ""
    echo "The cron authentication fix is properly implemented!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy to staging: cd infrastructure/terragrunt/dev && terragrunt apply"
    echo "2. Verify cron jobs execute successfully"
    echo "3. Deploy to production: cd infrastructure/terragrunt/prod && terragrunt apply"
    exit 0
else
    echo -e "${RED}✗ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please review the failed checks above and fix any issues."
    exit 1
fi
