# Google Cloud SQL Deployment Guide

## Overview

This guide covers the complete deployment of KeyFate infrastructure to Google Cloud, replacing Supabase with Google Cloud SQL PostgreSQL. All secrets are managed through Terraform tfvars files for automated, repeatable deployments.

## Infrastructure Components

### Completed Infrastructure

- ✅ Google Cloud SQL PostgreSQL instance with private IP
- ✅ VPC networking with private Google access
- ✅ Secret Manager for sensitive environment variables
- ✅ Cloud Run service with auto-scaling
- ✅ Artifact Registry for container images
- ✅ IAM service accounts and roles
- ✅ Automated secret management via Terraform

### Environment Variables Updated

- `NEXT_PUBLIC_AUTH_PROVIDER=google`
- `NEXT_PUBLIC_DATABASE_PROVIDER=cloudsql`
- All secrets managed via Secret Manager (automatically provisioned)
- Database connection string auto-generated with private IP

## Terraform-Based Deployment Process

### 1. Configure Environment Secrets

Create your environment-specific `terraform.tfvars` file:

```bash
# Copy the example template
cp terraform.tfvars.example terragrunt/{env}/terraform.tfvars

# Edit with your environment-specific values
# See "Required Configuration" section below
```

### 2. Generate Required Secrets

```bash
# Generate encryption keys
openssl rand -base64 32  # For encryption_key
openssl rand -base64 32  # For nextauth_secret
openssl rand -base64 32  # For db_password

# Add these values to your terraform.tfvars file
```

### 3. Deploy Infrastructure

```bash
# From infrastructure/terragrunt/{env}/ directory
terragrunt plan   # Review planned changes
terragrunt apply  # Deploy infrastructure with secrets
```

**Note**: Database URL is auto-generated using the Cloud SQL private IP and random password. No manual secret management required.

## Required Configuration

### Essential tfvars Variables

Create `terragrunt/{env}/terraform.tfvars` with these required values:

```hcl
# Organization & Billing (get from Google Cloud Console)
organization_id = "YOUR_ORG_ID"
folder_id       = "YOUR_FOLDER_ID"
billing_account = "XXXXXX-XXXXXX-XXXXXX"

# Environment
env = "staging"  # or "production"

# Secrets (generate using openssl rand -base64 32)
encryption_key  = "YOUR_32_BYTE_BASE64_KEY"
nextauth_secret = "YOUR_32_BYTE_BASE64_KEY"
db_password     = "YOUR_32_BYTE_BASE64_KEY"

# Google OAuth (from Google Cloud Console)
google_client_id     = "YOUR_CLIENT_ID.apps.googleusercontent.com"
google_client_secret = "GOCSPX-YOUR_CLIENT_SECRET"

# Stripe Integration
next_public_stripe_publishable_key = "pk_test_YOUR_PUBLISHABLE_KEY"
stripe_secret_key                  = "sk_test_YOUR_SECRET_KEY"

# Site Configuration
next_public_site_url     = "https://staging.yoursite.com"
next_public_company      = "Your Company"
next_public_support_email = "support@yourcompany.com"
custom_domain           = "staging.yoursite.com"

# Optional: BTCPay Server (if using Bitcoin payments)
btcpay_server_url     = "https://btcpay.yoursite.com"
btcpay_api_key        = "YOUR_BTCPAY_API_KEY"
btcpay_store_id       = "YOUR_BTCPAY_STORE_ID"
btcpay_webhook_secret = "YOUR_BTCPAY_WEBHOOK_SECRET"
```

See `terraform.tfvars.example` for complete configuration template with detailed documentation.

### Complete tfvars Checklist

**Required Variables** (must be set):

- `organization_id` - Google Cloud Organization ID
- `folder_id` - Google Cloud Folder ID
- `billing_account` - Google Cloud Billing Account
- `project_id` - Generated automatically from env and labels
- `region` - GCP region (e.g., "us-central1")
- `env` - Environment name ("staging" or "production")
- `labels` - Resource labels for organization
- `encryption_key` - 32-byte base64 encryption key
- `nextauth_secret` - 32-byte base64 NextAuth secret ⚠️ **Missing from current tfvars**
- `db_password` - 32-byte base64 database password for Cloud SQL ⚠️ **Required - add to tfvars**
- `google_client_id` - Google OAuth client ID
- `google_client_secret` - Google OAuth client secret
- `stripe_secret_key` - Stripe API secret key

**Auto-Generated Variables** (handled by Terraform):

- `db_url` - Database connection string (auto-generated from Cloud SQL)

**Important Public Variables**:

- `next_public_auth_provider` - Should be "google" ⚠️ **Missing from current tfvars**
- `next_public_database_provider` - Should be "cloudsql" ⚠️ **Missing from current tfvars**
- `next_public_site_url` - Your site URL
- `next_public_stripe_publishable_key` - Stripe public key
- `custom_domain` - Your custom domain

**Optional Variables** (for Bitcoin payments):

- `btcpay_server_url`, `btcpay_api_key`, `btcpay_store_id`, `btcpay_webhook_secret`

### Security Best Practices

1. **Never commit terraform.tfvars files** - They're automatically gitignored
2. **Use environment-specific files**:
   - `terragrunt/dev/terraform.tfvars` - Staging environment
   - `terragrunt/prod/terraform.tfvars` - Production environment
3. **Generate strong secrets**: `openssl rand -base64 32`
4. **Use test keys for staging** environments
5. **Enable deletion protection** for production: `deletion_protection = true`

### 4. Deploy Fresh Schema

The schema migration is handled automatically by Drizzle ORM:

```bash
# Build and deploy the application
# The schema will be created on first connection
npm run build
```

### 5. Verify Deployment

```bash
# Check Cloud SQL instance
gcloud sql instances describe keyfate-postgres-{env}

# Verify Secret Manager secrets are created
gcloud secrets list --filter="name:db-url OR name:nextauth-secret"

# Check database connection from application
npm run db:test

# Verify Cloud Run service
gcloud run services describe frontend --region={region}

# Test secret access from Cloud Run
gcloud secrets versions access latest --secret="db-url"
```

## Database Schema Details

### Tables Created

- `secrets` - Core secret management
- `admin_notifications` - System notifications
- `check_in_tokens` - Temporary check-in tokens
- `checkin_history` - Check-in audit trail
- `cron_config` - Cron job configuration
- `email_notifications` - Email delivery tracking
- `reminder_jobs` - Scheduled reminders
- `subscription_tiers` - Subscription plans
- `user_contact_methods` - User contact preferences
- `user_subscriptions` - User subscription status

### Enums Created

- `contact_method` - Communication preferences
- `secret_status` - Secret lifecycle states
- `subscription_tier` - Subscription levels
- `subscription_status` - Subscription states
- `reminder_status` - Reminder delivery states
- `reminder_type` - Reminder timing types

## Security Features

### Database Security

- Private IP connectivity only
- SSL/TLS encryption required
- VPC peering for secure access
- IAM-based authentication
- Connection pooling with health checks

### Secret Management

- All sensitive values in Secret Manager
- Service account-based access
- Automatic secret rotation support
- Environment-specific secrets

### Network Security

- Private Google access enabled
- No public database endpoints
- Cloud Run with service accounts
- SSL certificates auto-managed

## Monitoring & Observability

### Database Monitoring

- Connection pool health checks
- Response time monitoring
- Error rate tracking
- Resource utilization metrics

### Application Monitoring

- Cloud Run metrics
- Secret Manager access logs
- VPC flow logs
- Cloud SQL performance insights

## Terraform tfvars Benefits

### Automated Secret Management

- All secrets configured through tfvars files
- No manual gcloud commands required
- Environment-specific configuration
- Repeatable deployments

### Security Advantages

- Secrets stored in Google Secret Manager
- Service account-based access control
- Infrastructure as Code approach
- No secrets in Terraform state files

### Deployment Advantages

- Single `terragrunt apply` deploys everything
- Database connection auto-configured
- Environment parity guaranteed
- Easy disaster recovery

## Fresh Start Benefits

### No Migration Required

- Clean schema deployment
- No legacy data concerns
- Optimized table structures
- Latest PostgreSQL features

### Simplified Deployment

- Single infrastructure deployment
- Automatic schema creation
- Environment-specific configuration
- Scalable from day one

## Next Steps

1. Deploy to staging environment first
2. Validate all functionality
3. Run end-to-end tests
4. Deploy to production
5. Monitor performance metrics
6. Set up alerting thresholds

## Troubleshooting

### Common Issues

#### tfvars Configuration Issues

- **Missing variables**: Ensure all required variables are set in terraform.tfvars
- **Invalid secrets format**: Use base64-encoded secrets generated by `openssl rand -base64 32`
- **Wrong environment**: Verify you're deploying to the correct terragrunt/{env}/ directory

#### Infrastructure Issues

- **Connection timeout**: Check VPC peering and private IP configuration
- **Authentication failure**: Verify service account permissions
- **Schema creation failure**: Check database user permissions
- **Secret access denied**: Verify Secret Manager IAM roles

#### Secret Management Issues

- **Secret not found**: Verify secret was created by checking `gcloud secrets list`
- **Access denied**: Ensure Cloud Run service account has secretmanager.secretAccessor role
- **Wrong secret value**: Check if secret value in terraform.tfvars matches expected format

### Debug Commands

```bash
# Verify terraform.tfvars configuration
cat terragrunt/{env}/terraform.tfvars | grep -E "encryption_key|nextauth_secret"

# Check Terragrunt plan for secret changes
terragrunt plan | grep -A 5 -B 5 "secret"

# Test database connection
npm run db:test

# Check Cloud SQL status
gcloud sql instances describe keyfate-postgres-{env}

# Verify all secrets are created
gcloud secrets list --filter="name~(db-url|nextauth-secret|encryption-key|google-client)"

# Check specific secret values (be careful with this in production)
gcloud secrets versions access latest --secret="database-url"

# Verify Cloud Run service account has correct permissions
gcloud run services describe frontend --region={region} --format="value(spec.template.spec.serviceAccountName)"

# Check Cloud Run logs for secret access issues
gcloud run logs tail --service=frontend --region={region} | grep -i "secret\|auth\|database"

# Test Secret Manager access from Cloud Run service account
gcloud auth activate-service-account --key-file=path/to/service-account-key.json
```

## Migration from Manual gcloud Approach

If you previously used manual `gcloud secrets` commands, follow these steps to migrate to the tfvars approach:

### 1. Extract Current Secret Values

```bash
# Extract existing secrets (if they exist)
gcloud secrets versions access latest --secret="nextauth-secret" 2>/dev/null > /tmp/nextauth_secret.txt
gcloud secrets versions access latest --secret="encryption-key" 2>/dev/null > /tmp/encryption_key.txt
```

### 2. Add Missing Variables to tfvars

Add these lines to your `terragrunt/{env}/terraform.tfvars`:

```hcl
# Required variables missing from current setup
region = "us-central1"  # Your GCP region
project_id = "keyfate-{env}"  # Usually generated automatically

# Labels for resource organization
labels = {
  environment = "{env}"
  project     = "keyfate"
  managed-by  = "terraform"
}

# Authentication provider settings
next_public_auth_provider     = "google"
next_public_database_provider = "cloudsql"

# Missing secrets (generate new ones or use extracted values)
nextauth_secret = "$(cat /tmp/nextauth_secret.txt || openssl rand -base64 32)"
```

### 3. Apply Changes

```bash
# Plan to see what will change
terragrunt plan

# Apply the changes
terragrunt apply
```
