locals {
  # frontend_app_dir   = "${path.module}/../../frontend"
  frontend_app_name  = "frontend"
  frontend_app_dir   = "${path.module}/../../../../../../frontend"
  frontend_image_tag = md5(join("", [for f in fileset(local.frontend_app_dir, "**") : filemd5("${local.frontend_app_dir}/${f}")]))
}

# Build and push the frontend image when source files change
resource "null_resource" "build_and_push_frontend" {
  triggers = {
    app_dir_hash = local.frontend_image_tag
  }

  provisioner "local-exec" {
    command     = <<-EOT
      echo "Frontend directory hash: ${self.triggers.app_dir_hash}"

      BUILD_TAG=${var.region}-docker.pkg.dev/${module.project.id}/${module.artifact_registry.name}/${local.frontend_app_name}:${self.triggers.app_dir_hash}

      gcloud builds submit ${local.frontend_app_dir}/.. \
        --project=${module.project.id} \
        --config=${local.frontend_app_dir}/../cloudbuild.yaml \
        --substitutions=_IMAGE_TAG="$BUILD_TAG",_NEXT_PUBLIC_SITE_URL="${var.next_public_site_url}",_NEXT_PUBLIC_SUPABASE_URL="${var.next_public_supabase_url}",_NEXT_PUBLIC_SUPABASE_ANON_KEY="${var.next_public_supabase_anon_key}",_NEXT_PUBLIC_COMPANY="${var.next_public_company}",_NEXT_PUBLIC_PARENT_COMPANY="${var.next_public_parent_company}",_NEXT_PUBLIC_SUPPORT_EMAIL="${var.next_public_support_email}"

      if gcloud run services describe ${local.frontend_app_name} \
          --region=${var.region} \
          --project=${module.project.id} &>/dev/null; then
        gcloud run deploy ${local.frontend_app_name} \
          --image=$BUILD_TAG \
          --region=${var.region} \
          --platform=managed \
          --project=${module.project.id}
      fi
    EOT
    interpreter = ["bash", "-c"]
  }

  depends_on = [module.artifact_registry, google_project_iam_member.cloud_build_permissions]
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
      image = "${module.artifact_registry.url}/${local.frontend_app_name}:${local.frontend_image_tag}"
      ports = {
        default = {
          container_port = 3000
        }
      }
      # Additional environment variables from terraform.tfvars
      env = {
        ENV = var.env
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
    module.frontend_service_account,
    module.frontend_secrets
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
