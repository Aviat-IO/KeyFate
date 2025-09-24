#!/bin/bash

# Cloud SQL Setup Script for KeyFate (Dead Man's Switch)
# This script sets up a Cloud SQL PostgreSQL instance for production use

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"keyfate-production"}
INSTANCE_NAME="keyfate-db-production"
DATABASE_NAME="keyfate"
APP_USER="keyfate_app"
REGION="us-central1"
TIER="db-custom-2-8192"  # 2 vCPU, 8GB RAM - adjust as needed

echo "🚀 Setting up Cloud SQL for KeyFate..."
echo "Project ID: $PROJECT_ID"
echo "Instance: $INSTANCE_NAME"
echo "Database: $DATABASE_NAME"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
echo "📋 Setting Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable sqladmin.googleapis.com
gcloud services enable sql-component.googleapis.com

# Create Cloud SQL instance
echo "🏗️ Creating Cloud SQL PostgreSQL instance..."
gcloud sql instances create $INSTANCE_NAME \
    --database-version=POSTGRES_15 \
    --tier=$TIER \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=20GB \
    --storage-auto-increase \
    --enable-ssl \
    --backup-start-time=03:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04 \
    --deletion-protection

echo "✅ Cloud SQL instance created successfully!"

# Create database
echo "🗄️ Creating database..."
gcloud sql databases create $DATABASE_NAME \
    --instance=$INSTANCE_NAME

echo "✅ Database created successfully!"

# Generate a secure password for the app user
APP_PASSWORD=$(openssl rand -base64 32)

# Create application user
echo "👤 Creating application user..."
gcloud sql users create $APP_USER \
    --instance=$INSTANCE_NAME \
    --password="$APP_PASSWORD"

echo "✅ Application user created successfully!"

# Get connection information
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
PUBLIC_IP=$(gcloud sql instances describe $INSTANCE_NAME --format="value(ipAddresses[0].ipAddress)")

# Output connection details
echo ""
echo "🎉 Cloud SQL setup complete!"
echo ""
echo "CONNECTION DETAILS:"
echo "=================="
echo "Instance Connection Name: $INSTANCE_CONNECTION_NAME"
echo "Public IP: $PUBLIC_IP"
echo "Database: $DATABASE_NAME"
echo "Username: $APP_USER"
echo "Password: $APP_PASSWORD"
echo ""
echo "ENVIRONMENT VARIABLES:"
echo "====================="
echo "Add these to your .env file:"
echo ""
echo "DATABASE_URL=\"postgresql://$APP_USER:$APP_PASSWORD@$PUBLIC_IP:5432/$DATABASE_NAME?sslmode=require\""
echo "CLOUD_SQL_CONNECTION_NAME=\"$INSTANCE_CONNECTION_NAME\""
echo ""
echo "NEXT STEPS:"
echo "==========="
echo "1. Update your authorized networks if needed:"
echo "   gcloud sql instances patch $INSTANCE_NAME --authorized-networks=YOUR_IP/32"
echo ""
echo "2. Install Cloud SQL Proxy for local development:"
echo "   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64"
echo "   chmod +x cloud-sql-proxy"
echo ""
echo "3. Connect via proxy:"
echo "   ./cloud-sql-proxy $INSTANCE_CONNECTION_NAME --port 5432"
echo ""
echo "4. Run database migrations:"
echo "   npm run db:migrate"
echo ""
echo "⚠️  SECURITY NOTE: Store the password securely and consider using IAM authentication for production."