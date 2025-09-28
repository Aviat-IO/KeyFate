#!/bin/bash

# Deploy script for frontend application
# This script rebuilds the Docker image and deploys it via Terraform

set -e

# Configuration
PROJECT_ID="your-gcp-project-id"  # Replace with your actual project ID
REGION="us-central1"              # Replace with your actual region
IMAGE_NAME="frontend"
REGISTRY="gcr.io"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting frontend deployment...${NC}"

# Step 1: Build Docker image locally
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:latest .

# Step 2: Tag for GCR
echo -e "${YELLOW}Tagging image for Google Container Registry...${NC}"
docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${PROJECT_ID}/${IMAGE_NAME}:latest

# Step 3: Push to GCR
echo -e "${YELLOW}Pushing image to GCR...${NC}"
docker push ${REGISTRY}/${PROJECT_ID}/${IMAGE_NAME}:latest

# Step 4: Deploy via Terraform
echo -e "${YELLOW}Deploying via Terraform...${NC}"
cd ../infrastructure/terragrunt/dev
terragrunt apply -target=module.apps.google_cloud_run_v2_service.frontend -auto-approve

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}Your application should be available at https://staging.keyfate.com${NC}"