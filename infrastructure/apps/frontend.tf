locals {
  frontend_app_name = "frontend"
  # Use variable if provided (from Terragrunt), otherwise fall back to relative path
  frontend_app_dir = var.frontend_dir != "" ? var.frontend_dir : abspath("${path.module}/../../frontend")

  # Only track actual source code that affects the build
  # This is much faster and prevents unnecessary rebuilds
  frontend_source_patterns = [
    "src/app/**/*.{ts,tsx,js,jsx,css}",
    "src/components/**/*.{ts,tsx,js,jsx,css}",
    "src/lib/**/*.{ts,tsx,js,jsx}",
    "src/utils/**/*.{ts,tsx,js,jsx}",
    "src/**/*.{ts,tsx,js,jsx,css}",
    "public/**",
    "*.config.{js,ts}",
    "package.json",
    "pnpm-lock.yaml",
    "Dockerfile",
    "cloudbuild.yaml",
    ".dockerignore"
  ]

  # Efficient hash calculation - only files that actually matter
  frontend_content_hash = md5(join("", flatten([
    for pattern in local.frontend_source_patterns : [
      for f in try(fileset(local.frontend_app_dir, pattern), []) :
      can(filemd5("${local.frontend_app_dir}/${f}")) ? filemd5("${local.frontend_app_dir}/${f}") : ""
    ]
  ])))

  terraform_config_hash = filemd5("${path.module}/frontend.tf")

  # Combine content hash with terraform config for complete rebuild trigger
  combined_hash = md5("${local.frontend_content_hash}-${local.terraform_config_hash}")

  # Use the combined hash as the image tag to ensure Cloud Run updates
  image_tag = local.combined_hash

  # Get git commit for reference (used in labels, not image tag)
  git_commit_hash = trimspace(data.external.git_commit.result.commit_hash)
}

# Build and push the frontend image when source files change
# This resource ensures that both the image build AND Cloud Run deployment
# are triggered consistently when frontend code changes
resource "null_resource" "build_and_push_frontend" {
  triggers = {
    # Use the same hash for both triggering and image tagging
    combined_hash = local.combined_hash
  }

  provisioner "local-exec" {
    command     = <<-EOT
      set -e
      echo "Combined hash: ${self.triggers.combined_hash}"
      echo "Git commit: ${local.git_commit_hash}"

      BUILD_TAG=${var.region}-docker.pkg.dev/${module.project.id}/${module.artifact_registry.name}/${local.frontend_app_name}:${local.image_tag}

      echo "Building image via Cloud Build: $BUILD_TAG"

      # Ensure we're authenticated with gcloud
      gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null || gcloud auth login

      # Get the parent directory of frontend (the repo root)
      REPO_ROOT=$(dirname ${local.frontend_app_dir})

      # Use Cloud Build to build and push the image
      # Pass NEXT_PUBLIC_ variables as build args so they're baked into the image
      gcloud builds submit $REPO_ROOT \
        --project=${module.project.id} \
        --config=${local.frontend_app_dir}/cloudbuild.yaml \
        --substitutions="_IMAGE_URL=$BUILD_TAG,_BUILD_ENV=${var.env == "prod" ? "production" : "staging"},_NEXTAUTH_URL=${var.next_public_site_url},_NEXT_PUBLIC_SITE_URL=${var.next_public_site_url},_NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${var.next_public_stripe_publishable_key},_NEXT_PUBLIC_SUPPORT_EMAIL=${var.next_public_support_email}"

      echo "Cloud Build completed successfully!"

      # Wait a moment for the image to be available
      sleep 10

      # Verify the image exists in Artifact Registry
      gcloud artifacts docker images describe $BUILD_TAG --format="value(name)" || {
        echo "ERROR: Image not found in Artifact Registry after push"
        exit 1
      }

      echo "Image verified in Artifact Registry"
    EOT
    interpreter = ["bash", "-c"]
  }

  depends_on = [module.artifact_registry]
}

# Data source to get the latest git commit hash
data "external" "git_commit" {
  program = ["bash", "-c", "echo '{\"commit_hash\": \"'$(git rev-parse HEAD)'\"}'"]
}

# Data source to verify the image exists in Artifact Registry
data "google_artifact_registry_repository" "frontend_repo" {
  location      = var.region
  repository_id = module.artifact_registry.name
  project       = module.project.id
  depends_on    = [null_resource.build_and_push_frontend]
}

# Service account for the frontend Cloud Run service
module "frontend_service_account" {
  source       = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/iam-service-account"
  project_id   = module.project.id
  name         = "frontend-service"
  display_name = "Frontend Service Account"
  description  = "Service account for Frontend Cloud Run service"

  # Grant necessary roles for the frontend service
  iam_project_roles = {
    "${module.project.id}" = [
      "roles/secretmanager.secretAccessor",
      "roles/cloudsql.client",
      "roles/storage.objectViewer"
    ]
  }
}

# Cloud Run service for the frontend
module "cloud_run" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/cloud-run-v2"
  project_id = module.project.id
  name       = local.frontend_app_name
  region     = var.region

  service_account_config = {
    create = false
    email  = module.frontend_service_account.email
  }

  containers = {
    frontend = {
      image = "${module.artifact_registry.url}/${local.frontend_app_name}:${local.image_tag}"
      ports = {
        default = {
          container_port = 3000
        }
      }
      # Runtime environment variables - these override .env file values if needed
      # Most configuration comes from .env files baked into the image
      env = {
        # NextAuth.js requires NEXTAUTH_URL for production deployments
        NEXTAUTH_URL = var.next_public_site_url
        # Also set internal override to ensure NextAuth never falls back to 0.0.0.0
        NEXTAUTH_URL_INTERNAL = var.next_public_site_url
        # Older NextAuth versions require this env to trust X-Forwarded-Host
        AUTH_TRUST_HOST = "true"
        # Environment indicator for runtime checks
        NEXT_PUBLIC_ENV = var.env
        # All NEXT_PUBLIC_ variables that the app needs
        NEXT_PUBLIC_SITE_URL               = var.next_public_site_url
        NEXT_PUBLIC_COMPANY                = var.next_public_company
        NEXT_PUBLIC_PARENT_COMPANY         = var.next_public_parent_company
        NEXT_PUBLIC_SUPPORT_EMAIL          = var.next_public_support_email
        NEXT_PUBLIC_AUTH_PROVIDER          = var.next_public_auth_provider
        NEXT_PUBLIC_DATABASE_PROVIDER      = var.next_public_database_provider
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = var.next_public_stripe_publishable_key
        NEXT_PUBLIC_BTCPAY_SERVER_URL      = var.btcpay_server_url
        BTCPAY_SERVER_URL                  = var.btcpay_server_url
        # SendGrid configuration (non-sensitive)
        SENDGRID_SENDER_NAME               = var.sendgrid_sender_name
        SENDGRID_ADMIN_EMAIL               = var.sendgrid_admin_email
        # Force revision update when code changes by including hash as env var
        DEPLOYMENT_HASH = local.image_tag
        # Database connection timeout and pooling settings - optimized for Unix socket connection
        DB_CONNECT_TIMEOUT   = "10"    # 10 seconds connection timeout (fail fast)
        DB_POOL_MAX          = "5"     # Reduced max pool connections to prevent exhaustion
        DB_POOL_MIN          = "1"     # Minimum pool connections
        DB_IDLE_TIMEOUT      = "20"    # 20 seconds idle timeout (release connections faster)
        DB_STATEMENT_TIMEOUT = "30000" # 30 seconds statement timeout
        DB_MAX_LIFETIME      = "300"   # 5 minutes max connection lifetime
      }
      # Secret environment variables from Secret Manager
      env_from_key = {
        DATABASE_URL = {
          secret  = "projects/${module.project.number}/secrets/database-url"
          version = "latest"
        }
        ENCRYPTION_KEY = {
          secret  = "projects/${module.project.number}/secrets/encryption-key"
          version = "latest"
        }
        GOOGLE_CLIENT_ID = {
          secret  = "projects/${module.project.number}/secrets/google-client-id"
          version = "latest"
        }
        GOOGLE_CLIENT_SECRET = {
          secret  = "projects/${module.project.number}/secrets/google-client-secret"
          version = "latest"
        }
        NEXTAUTH_SECRET = {
          secret  = "projects/${module.project.number}/secrets/nextauth-secret"
          version = "latest"
        }
        STRIPE_SECRET_KEY = {
          secret  = "projects/${module.project.number}/secrets/stripe-secret-key"
          version = "latest"
        }
        STRIPE_WEBHOOK_SECRET = {
          secret  = "projects/${module.project.number}/secrets/stripe-webhook-secret"
          version = "latest"
        }
        BTCPAY_API_KEY = {
          secret  = "projects/${module.project.number}/secrets/btcpay-api-key"
          version = "latest"
        }
        BTCPAY_STORE_ID = {
          secret  = "projects/${module.project.number}/secrets/btcpay-store-id"
          version = "latest"
        }
        BTCPAY_WEBHOOK_SECRET = {
          secret  = "projects/${module.project.number}/secrets/btcpay-webhook-secret"
          version = "latest"
        }
        CRON_SECRET = {
          secret  = google_secret_manager_secret.cron_secret.id
          version = "latest"
        }
        SENDGRID_API_KEY = {
          secret  = "projects/${module.project.number}/secrets/sendgrid-api-key"
          version = "latest"
        }
      }
      resources = {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
        startup_cpu_boost = var.cpu_boost
      }
      # Mount Cloud SQL volume
      volume_mounts = {
        cloudsql = "/cloudsql"
      }
    }
  }

  service_config = {
    max_instance_count = var.max_instances
    min_instance_count = var.min_instances

    # VPC connector for private Cloud SQL access via Cloud SQL Auth Proxy
    vpc_connector_config = {
      connector = google_vpc_access_connector.vpc_connector.name
      egress    = "PRIVATE_RANGES_ONLY" # Only route private traffic through VPC
    }
  }

  revision = {
    # Force new revision when image changes
    annotations = {
      "deployment.hash"                          = local.image_tag
      "git.commit"                               = local.git_commit_hash
      "run.googleapis.com/execution-environment" = "gen2"
    }
  }

  # Add Cloud SQL connection as a volume
  volumes = {
    "cloudsql" = {
      cloud_sql_instances = [module.cloudsql_instance.connection_name]
    }
  }

  iam = {
    "roles/run.invoker" = var.allow_unauthenticated ? ["allUsers"] : []
  }

  labels = var.labels

  deletion_protection = var.deletion_protection

  depends_on = [
    null_resource.build_and_push_frontend,
    data.google_artifact_registry_repository.frontend_repo,
    module.frontend_service_account,
    module.frontend_secrets,
    google_secret_manager_secret_version.database_url,
    google_vpc_access_connector.vpc_connector
  ]
}

# Automatically update traffic to latest revision after deployment
resource "null_resource" "update_traffic" {
  triggers = {
    # Trigger when the image changes
    image_tag  = local.image_tag
    service_id = module.cloud_run.id
  }

  provisioner "local-exec" {
    command     = <<-EOT
      set -e
      echo "Waiting for Cloud Run service to be ready..."
      sleep 5

      echo "Updating traffic to latest revision..."
      gcloud run services update-traffic ${local.frontend_app_name} \
        --region=${var.region} \
        --project=${module.project.id} \
        --to-latest \
        --quiet || true

      echo "Traffic updated successfully"
    EOT
    interpreter = ["bash", "-c"]
  }

  depends_on = [module.cloud_run]
}

# Domain mapping for custom domain
resource "google_cloud_run_domain_mapping" "frontend_domain" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.region
  name     = var.custom_domain
  project  = module.project.id

  metadata {
    namespace = module.project.id
  }

  spec {
    route_name = module.cloud_run.service_name
  }
}
