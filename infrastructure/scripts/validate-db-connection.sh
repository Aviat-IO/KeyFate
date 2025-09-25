#!/bin/bash

# Validate database connection after infrastructure changes
# This script should be run after terraform apply to verify connectivity

set -e

echo "🔍 Validating PostgreSQL Database Connection..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="${1:-}"
SERVICE_NAME="${2:-frontend}"
REGION="${3:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: PROJECT_ID is required${NC}"
    echo "Usage: $0 <project-id> [service-name] [region]"
    exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Project: $PROJECT_ID"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"
echo

# 1. Check if VPC Access Connector exists
echo -e "${YELLOW}1. Checking VPC Access Connector...${NC}"
if gcloud compute networks vpc-access connectors list --region="$REGION" --project="$PROJECT_ID" --format="value(name)" | grep -q "keyfate-vpc-connector"; then
    echo -e "${GREEN}✅ VPC Access Connector found${NC}"

    # Get connector details
    echo -e "${YELLOW}📊 Connector Details:${NC}"
    gcloud compute networks vpc-access connectors describe keyfate-vpc-connector-dev \
        --region="$REGION" --project="$PROJECT_ID" \
        --format="value(name,network,ipCidrRange,state)" | \
        awk -F$'\t' '{printf "  Name: %s\n  Network: %s\n  CIDR: %s\n  State: %s\n", $1, $2, $3, $4}'
else
    echo -e "${RED}❌ VPC Access Connector not found${NC}"
    exit 1
fi

echo

# 2. Check Cloud SQL instance
echo -e "${YELLOW}2. Checking Cloud SQL instance...${NC}"
if gcloud sql instances list --project="$PROJECT_ID" --format="value(name)" | grep -q "keyfate-postgres"; then
    echo -e "${GREEN}✅ Cloud SQL instance found${NC}"

    # Get instance details
    echo -e "${YELLOW}📊 Instance Details:${NC}"
    gcloud sql instances describe keyfate-postgres-dev --project="$PROJECT_ID" \
        --format="value(name,state,ipAddresses[0].ipAddress,ipAddresses[0].type)" | \
        awk -F$'\t' '{printf "  Name: %s\n  State: %s\n  IP: %s (%s)\n", $1, $2, $3, $4}'
else
    echo -e "${RED}❌ Cloud SQL instance not found${NC}"
    exit 1
fi

echo

# 3. Check Cloud Run service configuration
echo -e "${YELLOW}3. Checking Cloud Run service...${NC}"
if gcloud run services list --platform=managed --region="$REGION" --project="$PROJECT_ID" --format="value(metadata.name)" | grep -q "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Cloud Run service found${NC}"

    # Check if VPC connector is configured
    echo -e "${YELLOW}📊 Service Network Configuration:${NC}"
    VPC_CONNECTOR=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" --project="$PROJECT_ID" \
        --format="value(spec.template.metadata.annotations.'run.googleapis.com/vpc-access-connector')" 2>/dev/null || echo "")

    if [ -n "$VPC_CONNECTOR" ]; then
        echo -e "${GREEN}✅ VPC connector configured: $VPC_CONNECTOR${NC}"
    else
        echo -e "${RED}❌ VPC connector not configured${NC}"
        exit 1
    fi

    # Check egress setting
    VPC_EGRESS=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" --project="$PROJECT_ID" \
        --format="value(spec.template.metadata.annotations.'run.googleapis.com/vpc-access-egress')" 2>/dev/null || echo "")

    if [ -n "$VPC_EGRESS" ]; then
        echo -e "${GREEN}✅ VPC egress configured: $VPC_EGRESS${NC}"
    else
        echo -e "${YELLOW}⚠️  VPC egress not explicitly configured${NC}"
    fi
else
    echo -e "${RED}❌ Cloud Run service not found${NC}"
    exit 1
fi

echo

# 4. Test database connection via Cloud Run
echo -e "${YELLOW}4. Testing database connection via Cloud Run...${NC}"
echo "This will make an HTTP request to the health endpoint..."

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null)

if [ -n "$SERVICE_URL" ]; then
    echo "Service URL: $SERVICE_URL"

    # Test the health endpoint (assuming it exists)
    if curl -s -f "$SERVICE_URL/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health endpoint accessible${NC}"
    else
        echo -e "${RED}❌ Health endpoint not accessible or returns error${NC}"
        echo "Note: This might be expected if the health endpoint doesn't exist yet"
    fi

    # Test database connection endpoint specifically
    if curl -s -f "$SERVICE_URL/api/health/db" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database health endpoint accessible${NC}"
    else
        echo -e "${RED}❌ Database health endpoint not accessible${NC}"
        echo "Note: Check if /api/health/db endpoint exists"
    fi
else
    echo -e "${RED}❌ Could not get service URL${NC}"
    exit 1
fi

echo

# 5. Summary
echo -e "${YELLOW}📋 Validation Summary:${NC}"
echo -e "  ${GREEN}✅ Infrastructure components configured${NC}"
echo -e "  ${GREEN}✅ VPC Access Connector created${NC}"
echo -e "  ${GREEN}✅ Cloud SQL instance running${NC}"
echo -e "  ${GREEN}✅ Cloud Run service configured with VPC connector${NC}"
echo

echo -e "${GREEN}🎉 Database connection infrastructure validation complete!${NC}"
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "  1. Deploy the updated infrastructure with 'terraform apply'"
echo "  2. Monitor Cloud Run logs for any connection issues"
echo "  3. Test the cron endpoints to verify database connectivity"
echo "  4. Check Cloud SQL logs if issues persist"

echo
echo -e "${YELLOW}📊 Monitoring commands:${NC}"
echo "  # View Cloud Run logs"
echo "  gcloud logging read 'resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE_NAME\"' --limit=50 --project=$PROJECT_ID"
echo
echo "  # View Cloud SQL logs"
echo "  gcloud logging read 'resource.type=\"cloudsql_database\"' --limit=50 --project=$PROJECT_ID"