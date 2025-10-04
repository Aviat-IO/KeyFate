# KeyFate Infrastructure

This directory contains the Terraform configuration for deploying KeyFate's infrastructure, including the Cloud Run service with automated container image building and secure secret management.

## Architecture

The infrastructure uses:

- **Terragrunt** for environment management and DRY configuration
- **Cloud Foundation Fabric** modules for Google Cloud resources
- **Cloud Run** for the containerized frontend application
- **Artifact Registry** for container image storage
- **Cloud Build** for automated image building
- **Secret Manager** for secure environment variable storage
- **Dedicated Service Account** for the Cloud Run service

## Environments

- **dev**: Development/staging environment (`keyfate-dev` project)
- **prod**: Production environment (`keyfate-prod` project)

## Migration from Makefile

The deployment has been migrated from the Makefile (`make deploy-staging` and `make deploy-prod`) to Terraform using the Cloud Foundation Fabric modules with automated image building and secure secret management.

### Key Changes

- **Automated Image Building**: Images are built automatically when frontend source files change
- **Hash-based Tagging**: Images are tagged with MD5 hash of source files for reproducible builds
- **Artifact Registry**: Container images are stored in Google Artifact Registry
- **Secret Manager Integration**: Sensitive environment variables are stored in Secret Manager
- **Dedicated Service Account**: Cloud Run service runs with least-privilege service account
- **Infrastructure as Code**: All deployment settings are version-controlled and reproducible

## Setup

1. **Copy terraform.tfvars files**:

   ```bash
   # For dev environment
   cp terragrunt/dev/terraform.tfvars.example terragrunt/dev/terraform.tfvars

   # For prod environment
   cp terragrunt/prod/terraform.tfvars.example terragrunt/prod/terraform.tfvars
   ```

2. **Fill in sensitive values** in the terraform.tfvars files:
   - Organization and billing account details
   - Public environment variables (NEXT_PUBLIC_*)
   - Secret environment variables (stored in Secret Manager)
   - Supabase configuration for cron jobs

3. **Deploy**:

   ```bash
   # Deploy to dev
   cd terragrunt/dev
   terragrunt apply

   # Deploy to prod
   cd terragrunt/prod
   terragrunt apply
   ```

## Supabase Configuration

The infrastructure automatically configures Supabase cron jobs for your application using the consolidated migration approach. This eliminates the need for manual SQL execution and ensures consistent cron job setup across all environments.

### Required Variables

For Supabase cron job configuration, ensure these variables are set in your `terraform.tfvars`:

```hcl
# Note: If using Cloud SQL instead of Supabase, the database name is 'keyfate' (not environment-specific)
db_url = "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres"
# For Cloud SQL: "postgresql://keyfate_app:[password]@[cloud-sql-ip]:5432/keyfate"
```

### How It Works

1. **Automatic Configuration**: When you run `terragrunt apply`, the infrastructure:
   - Applies all database migrations (including the consolidated schema)
   - Automatically configures the `cron_config` table with your environment settings
   - Verifies that cron jobs are properly scheduled

2. **Idempotent Operations**: The SQL configuration is idempotent, meaning:
   - Safe to run multiple times
   - Updates configuration if values change
   - No manual intervention required

3. **Environment-Specific**: Each environment (dev/prod) gets its own cron configuration:
   - **Dev**: Points to your development Supabase project
   - **Prod**: Points to your production Supabase project

### Prerequisites

Ensure you have either:

- **PostgreSQL client** (`psql`) installed on your system, OR
- **Supabase CLI** installed and configured

Install via:

```bash
# PostgreSQL client (recommended)
brew install postgresql        # macOS
apt-get install postgresql-client  # Ubuntu/Debian

# OR Supabase CLI
npm install -g supabase
```

### Verification

After deployment, the infrastructure automatically verifies the configuration and displays:

- Cron configuration status
- Scheduled cron jobs ('check-secrets', 'process-reminders')
- Service role key status

You can also manually verify by checking the Supabase logs or running:

```sql
SELECT * FROM cron_config;
SELECT * FROM cron.job WHERE jobname IN ('check-secrets', 'process-reminders');
```

## Automated Image Building

The infrastructure automatically handles container image building and deployment:

1. **Source Change Detection**: Terraform calculates MD5 hash of all files in `frontend/` directory
2. **Conditional Building**: Images are only built when source files change
3. **Cloud Build**: Uses `gcloud builds submit` to build and push images
4. **Registry Storage**: Images are stored in Google Artifact Registry
5. **Service Update**: Cloud Run service is automatically updated with new image

### How it Works

```hcl
# Source file hash triggers rebuild
frontend_image_tag = md5(join("", [for f in fileset(local.frontend_app_dir, "**") : filemd5("${local.frontend_app_dir}/${f}")]))

# Build and push when hash changes
resource "null_resource" "build_and_push_frontend" {
  triggers = {
    app_dir_hash = local.frontend_image_tag
  }
  # ... Cloud Build commands
}
```

## Secret Management

The infrastructure uses Google Secret Manager for secure environment variable storage:

### Public Environment Variables

Variables prefixed with `NEXT_PUBLIC_` are stored as regular environment variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_COMPANY`
- And others...

### Secret Environment Variables

Sensitive variables are stored in Secret Manager and injected at runtime:

- `DB_URL`: Database connection string
- `ENCRYPTION_KEY`: Application encryption key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials

### How Secrets Work

```hcl
# Secrets are created in Secret Manager
module "frontend_secrets" {
  source = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/secret-manager"
  # ... secret definitions
}

# Secrets are injected into Cloud Run
env_from_key = {
  DB_URL = {
    secret  = "projects/${module.project.number}/secrets/db-url"
    version = "latest"
  }
  # ... other secrets
}
```

## Configuration

### Cloud Run Settings

The Cloud Run service is configured with:

- **Dedicated Service Account**: `frontend-service@project-id.iam.gserviceaccount.com`
- **CPU Boost**: Enabled for faster cold starts
- **Min Instances**: 0 (for cost optimization)
- **Max Instances**: 10 (configurable)
- **Unauthenticated Access**: Enabled (public facing)
- **Memory/CPU**: Configurable per environment

### Custom Domain Configuration

To configure a custom domain (e.g., `staging.keyfate.com`), add the `custom_domain` variable to your `terraform.tfvars`:

```hcl
custom_domain = "staging.keyfate.com"
```

This will create a Google Cloud Run domain mapping that allows your custom domain to route to the Cloud Run service.

**Prerequisites:**

1. Set up DNS CNAME record pointing your domain to the Cloud Run service URL
2. Configure the `custom_domain` variable in `terraform.tfvars`
3. Apply the Terraform configuration

**Steps:**

1. Get the Cloud Run service URL from Terraform outputs
2. Create a CNAME record: `staging.keyfate.com` → `frontend-PROJECT_ID.run.app`
3. Set `custom_domain = "staging.keyfate.com"` in `terraform.tfvars`
4. Run `terragrunt apply`

The domain mapping will automatically provision SSL certificates and route traffic properly.

### Service Account Permissions

The frontend service account has the following roles:

- `roles/secretmanager.secretAccessor`: Access to secrets
- `roles/cloudsql.client`: Database connectivity
- `roles/storage.objectViewer`: Cloud Storage access

### Environment Variables

Environment variables are managed through terraform.tfvars and injected via:

- **Regular env vars**: Public configuration (NEXT_PUBLIC_*)
- **Secret Manager**: Sensitive configuration (DB credentials, API keys, etc.)

**Important**: The terraform.tfvars files are gitignored and contain sensitive data.

## Outputs

The deployment provides:

- `cloud_run_service_url`: The public URL of the deployed service
- `cloud_run_service_name`: The name of the Cloud Run service
- `artifact_registry_url`: The URL of the container registry
- `frontend_service_account_email`: The service account email
- `project_id`: The Google Cloud project ID
- `project_number`: The Google Cloud project number

## Accessing the Service

After deployment, the service URL will be available in the Terraform outputs:

```bash
terragrunt output cloud_run_service_url
```

## Updating the Service

To update the service, simply modify files in the `frontend/` directory and run:

```bash
terragrunt apply
```

Terraform will:

1. Detect source file changes via hash comparison
2. Build and push a new container image
3. Update the Cloud Run service with the new image
4. Perform a zero-downtime deployment

No manual image building or pushing is required!

## Security Benefits

- **Secret Isolation**: Sensitive data never appears in Terraform state or logs
- **Least Privilege**: Service account has minimal required permissions
- **Encryption**: All secrets are encrypted at rest and in transit
- **Audit Trail**: Secret Manager provides full audit logs
- **Rotation**: Secrets can be rotated without redeploying infrastructure

## Architecture Benefits

- **Reproducible Deployments**: Hash-based image tagging ensures consistent builds
- **Cost Optimization**: Images are only built when needed
- **Security**: Secrets managed via Secret Manager with least-privilege access
- **Scalability**: Artifact Registry provides fast, regional image storage
- **Automation**: Complete CI/CD pipeline with secure secret management in Terraform
