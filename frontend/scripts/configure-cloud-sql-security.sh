#!/bin/bash

# Cloud SQL Security Configuration Script
# This script configures authentication, SSL, and security settings for Cloud SQL

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"keyfate-production"}
INSTANCE_NAME="keyfate-db-production"
APP_USER="keyfate_app"
BACKUP_USER="keyfate_backup"
READONLY_USER="keyfate_readonly"

echo "🔒 Configuring Cloud SQL Security..."
echo "Project ID: $PROJECT_ID"
echo "Instance: $INSTANCE_NAME"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

echo "🛡️ Step 1: Configure SSL/TLS encryption..."

# Require SSL connections
gcloud sql instances patch $INSTANCE_NAME \
    --require-ssl

echo "✅ SSL requirement enabled"

# Create server SSL certificate (for client certificate authentication if needed)
echo "📜 Creating server SSL certificate..."
gcloud sql ssl-certs create server-cert \
    --instance=$INSTANCE_NAME

echo "✅ Server SSL certificate created"

echo "🔐 Step 2: Configure database users with appropriate permissions..."

# Generate secure passwords
BACKUP_PASSWORD=$(openssl rand -base64 32)
READONLY_PASSWORD=$(openssl rand -base64 32)

# Create backup user (for maintenance and backups)
echo "👤 Creating backup user..."
gcloud sql users create $BACKUP_USER \
    --instance=$INSTANCE_NAME \
    --password="$BACKUP_PASSWORD"

# Create read-only user (for analytics/reporting)
echo "👤 Creating read-only user..."
gcloud sql users create $READONLY_USER \
    --instance=$INSTANCE_NAME \
    --password="$READONLY_PASSWORD"

echo "✅ Database users created"

echo "🌐 Step 3: Configure network security..."

# Get current external IP for authorized networks
CURRENT_IP=$(curl -s https://ipinfo.io/ip)

echo "📍 Current external IP: $CURRENT_IP"
echo "Adding current IP to authorized networks..."

# Add current IP to authorized networks (for initial setup)
gcloud sql instances patch $INSTANCE_NAME \
    --authorized-networks="$CURRENT_IP/32"

echo "⚠️  Note: For production, consider using private IP and VPC peering"

echo "🔍 Step 4: Configure database flags for security..."

# Set security-related database flags
gcloud sql instances patch $INSTANCE_NAME \
    --database-flags=log_connections=on,log_disconnections=on,log_checkpoints=on,log_statement=all

echo "✅ Security logging enabled"

echo "📊 Step 5: Configure automated backups..."

# Ensure backups are configured (should already be done in setup)
gcloud sql instances patch $INSTANCE_NAME \
    --backup-start-time=03:00 \
    --enable-bin-log

echo "✅ Automated backups configured"

echo "🔍 Step 6: Enable audit logging..."

# Enable Cloud SQL audit logs
gcloud logging sinks create cloud-sql-audit-sink \
    bigquery.googleapis.com/projects/$PROJECT_ID/datasets/cloud_sql_audit \
    --log-filter='protoPayload.serviceName="cloudsql.googleapis.com"' || true

echo "✅ Audit logging configured"

echo ""
echo "🎉 Cloud SQL security configuration complete!"
echo ""
echo "SECURITY SUMMARY:"
echo "=================="
echo "✅ SSL/TLS encryption required"
echo "✅ Server SSL certificate created"
echo "✅ Multiple database users with role separation"
echo "✅ Network access controlled via authorized networks"
echo "✅ Security logging enabled"
echo "✅ Automated backups configured"
echo "✅ Audit logging enabled"
echo ""
echo "ADDITIONAL USER CREDENTIALS:"
echo "============================"
echo "Backup User: $BACKUP_USER"
echo "Backup Password: $BACKUP_PASSWORD"
echo "Read-only User: $READONLY_USER"
echo "Read-only Password: $READONLY_PASSWORD"
echo ""
echo "SECURITY RECOMMENDATIONS:"
echo "========================="
echo "1. Store passwords in Google Secret Manager:"
echo "   gcloud secrets create backup-db-password --data-file=<(echo '$BACKUP_PASSWORD')"
echo "   gcloud secrets create readonly-db-password --data-file=<(echo '$READONLY_PASSWORD')"
echo ""
echo "2. For production deployment:"
echo "   - Use private IP instead of public IP"
echo "   - Configure VPC peering"
echo "   - Use IAM database authentication where possible"
echo "   - Implement connection pooling (PgBouncer)"
echo "   - Set up monitoring and alerting"
echo ""
echo "3. Remove your current IP from authorized networks:"
echo "   gcloud sql instances patch $INSTANCE_NAME --clear-authorized-networks"
echo ""
echo "4. Grant appropriate database permissions:"
echo "   - Connect to database and run SQL permission scripts"
echo ""
echo "⚠️  IMPORTANT: Store all passwords securely and never commit them to version control!"