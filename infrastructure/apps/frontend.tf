locals {
  # frontend_app_dir   = "${path.module}/../../frontend"
  frontend_app_name  = "frontend"
  frontend_app_dir   = "${path.module}/../../../../../../frontend"
  frontend_image_tag = md5(join("", [for f in fileset(local.frontend_app_dir, "**") : filemd5("${local.frontend_app_dir}/${f}")]))
  # Include this file in the hash to force rebuild when Terraform config changes
  terraform_config_hash = filemd5("${path.module}/frontend.tf")
  # Get the latest git commit hash for image tagging
  git_commit_hash = trimspace(data.external.git_commit.result.commit_hash)

}

# Build and push the frontend image when source files change
resource "null_resource" "build_and_push_frontend" {
  triggers = {
    app_dir_hash     = local.frontend_image_tag
    terraform_config = local.terraform_config_hash
  }

  provisioner "local-exec" {
    command     = <<-EOT
      set -e
      echo "Frontend directory hash: ${self.triggers.app_dir_hash}"
      echo "Terraform config hash: ${self.triggers.terraform_config}"

      BUILD_TAG=${var.region}-docker.pkg.dev/${module.project.id}/${module.artifact_registry.name}/${local.frontend_app_name}:${local.git_commit_hash}

      echo "Building image: $BUILD_TAG"

      # Ensure we're authenticated with gcloud
      gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 > /dev/null || gcloud auth login

      # Configure Docker to use gcloud as a credential helper
      gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet

      # Build the Docker image locally with environment-specific build arg
      docker build \
        --platform linux/amd64 \
        --build-arg BUILD_ENV=${var.env == "prod" ? "production" : "staging"} \
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
  source       = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/iam-service-account"
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
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/cloud-run-v2"
  project_id = module.project.id
  name       = local.frontend_app_name
  region     = var.region

  service_account = module.frontend_service_account.email

  containers = {
    frontend = {
      image = "${module.artifact_registry.url}/${local.frontend_app_name}:${local.git_commit_hash}"
      ports = {
        default = {
          container_port = 3000
        }
      }
      # Additional environment variables from terraform.tfvars
      env = {
        ENV                                = var.env
        NEXT_PUBLIC_SITE_URL               = var.next_public_site_url
        NEXT_PUBLIC_SUPABASE_URL           = var.next_public_supabase_url
        NEXT_PUBLIC_SUPABASE_ANON_KEY      = var.next_public_supabase_anon_key
        NEXT_PUBLIC_COMPANY                = var.next_public_company
        NEXT_PUBLIC_PARENT_COMPANY         = var.next_public_parent_company
        NEXT_PUBLIC_SUPPORT_EMAIL          = var.next_public_support_email
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = var.next_public_stripe_publishable_key
      }
      # Secret environment variables from Secret Manager
      env_from_key = {
        DB_URL = {
          secret  = "projects/${module.project.number}/secrets/db-url"
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
        SUPABASE_JWT_SECRET = {
          secret  = "projects/${module.project.number}/secrets/supabase-jwt-secret"
          version = "latest"
        }
        SUPABASE_SERVICE_ROLE_KEY = {
          secret  = "projects/${module.project.number}/secrets/supabase-service-role-key"
          version = "latest"
        }
        STRIPE_SECRET_KEY = {
          secret  = "projects/${module.project.number}/secrets/stripe-secret-key"
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

  revision = {
    max_instance_count = var.max_instances
    min_instance_count = var.min_instances
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
    data.external.git_commit
  ]
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
