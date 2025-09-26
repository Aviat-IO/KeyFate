locals {
  frontend_app_name = "frontend"
  # Use variable if provided (from Terragrunt), otherwise fall back to relative path
  frontend_app_dir = var.frontend_dir != "" ? var.frontend_dir : abspath("${path.module}/../../frontend")

  # Create a comprehensive hash that includes both file contents and terraform config
  frontend_content_hash = md5(join("", [
    for f in fileset(local.frontend_app_dir, "**") : filemd5("${local.frontend_app_dir}/${f}")
  ]))
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

      echo "Building image: $BUILD_TAG"

      # Ensure we're authenticated with gcloud
      gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null || gcloud auth login

      # Configure Docker to use gcloud as a credential helper
      gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet

      # Build the Docker image locally with environment-specific build args
      docker build \
        --platform linux/amd64 \
        --build-arg BUILD_ENV=${var.env == "prod" ? "production" : "staging"} \
        --build-arg NEXT_PUBLIC_SITE_URL="${var.next_public_site_url}" \
        --build-arg NEXT_PUBLIC_COMPANY="${var.next_public_company}" \
        --build-arg NEXT_PUBLIC_PARENT_COMPANY="${var.next_public_parent_company}" \
        --build-arg NEXT_PUBLIC_SUPPORT_EMAIL="${var.next_public_support_email}" \
        --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${var.next_public_stripe_publishable_key}" \
        --build-arg NEXT_PUBLIC_AUTH_PROVIDER="${var.next_public_auth_provider}" \
        --build-arg NEXT_PUBLIC_DATABASE_PROVIDER="${var.next_public_database_provider}" \
        --build-arg NEXT_PUBLIC_ENV="${var.env}" \
        -t $BUILD_TAG \
        -f ${local.frontend_app_dir}/Dockerfile \
        ${local.frontend_app_dir}

      echo "Image built successfully. Pushing to Artifact Registry..."

      # Push the image to Artifact Registry
      docker push $BUILD_TAG

      echo "Image pushed successfully: $BUILD_TAG"

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

  service_account = module.frontend_service_account.email

  containers = {
    frontend = {
      image = "${module.artifact_registry.url}/${local.frontend_app_name}:${local.image_tag}"
      ports = {
        default = {
          container_port = 3000
        }
      }
      # Additional environment variables from terraform.tfvars
      env = {
        NEXT_PUBLIC_COMPANY                = var.next_public_company
        NEXT_PUBLIC_ENV                    = var.env
        NEXT_PUBLIC_PARENT_COMPANY         = var.next_public_parent_company
        NEXT_PUBLIC_SITE_URL               = var.next_public_site_url
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = var.next_public_stripe_publishable_key
        NEXT_PUBLIC_AUTH_PROVIDER          = var.next_public_auth_provider
        NEXT_PUBLIC_DATABASE_PROVIDER      = var.next_public_database_provider
        NEXT_PUBLIC_SUPPORT_EMAIL          = var.next_public_support_email
        NEXT_PUBLIC_BTCPAY_SERVER_URL      = var.btcpay_server_url
        BTCPAY_SERVER_URL                  = var.btcpay_server_url
        # NextAuth.js requires NEXTAUTH_URL for production deployments
        NEXTAUTH_URL                       = var.next_public_site_url
        # Force revision update when code changes by including hash as env var
        DEPLOYMENT_HASH = local.image_tag
        # Database connection timeout and pooling settings
        DB_CONNECT_TIMEOUT    = "30"     # 30 seconds connection timeout
        DB_POOL_MAX          = "20"     # Maximum pool connections
        DB_POOL_MIN          = "5"      # Minimum pool connections
        DB_IDLE_TIMEOUT      = "600"    # 10 minutes idle timeout
        DB_STATEMENT_TIMEOUT = "30000"  # 30 seconds statement timeout
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
      }
      resources = {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
        startup_cpu_boost = var.cpu_boost
      }
    }
  }

  service_config = {
    max_instance_count = var.max_instances
    min_instance_count = var.min_instances

    # VPC connector for private Cloud SQL access
    vpc_connector_config = {
      connector = google_vpc_access_connector.vpc_connector.name
      egress    = "PRIVATE_RANGES_ONLY" # Only route private traffic through VPC
    }
  }

  revision = {
    # Force new revision when image changes
    annotations = {
      "deployment.hash" = local.image_tag
      "git.commit"      = local.git_commit_hash
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
    # Trigger when the image changes or Cloud Run service updates
    image_tag = local.image_tag
    service_id = module.cloud_run.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "Waiting for Cloud Run service to be ready..."
      sleep 15

      echo "Getting latest revision..."
      LATEST_REVISION=$(gcloud run services describe ${local.frontend_app_name} \
        --region=${var.region} \
        --project=${module.project.id} \
        --format="value(status.latestCreatedRevisionName)")

      echo "Latest revision: $LATEST_REVISION"

      if [ -n "$LATEST_REVISION" ]; then
        echo "Updating traffic to send 100% to latest revision: $LATEST_REVISION"
        gcloud run services update-traffic ${local.frontend_app_name} \
          --region=${var.region} \
          --project=${module.project.id} \
          --to-latest \
          --quiet || true

        echo "Traffic updated successfully to latest revision"
      else
        echo "Could not determine latest revision, skipping traffic update"
      fi
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

# Output for debugging deployment
output "frontend_deployment_info" {
  value = {
    image_tag         = local.image_tag
    git_commit        = local.git_commit_hash
    content_hash      = local.frontend_content_hash
    terraform_hash    = local.terraform_config_hash
    full_image_url    = "${module.artifact_registry.url}/${local.frontend_app_name}:${local.image_tag}"
    cloud_run_service = module.cloud_run.service_name
  }
  description = "Frontend deployment information for debugging"
}
