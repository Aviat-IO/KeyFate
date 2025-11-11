# Cloud SQL Auth Proxy as Cloud Run v2 Service
# Provides remote access to private Cloud SQL instance via IAM authentication

# Service Account for Cloud SQL Proxy
resource "google_service_account" "sql_proxy" {
  project      = module.project.id
  account_id   = "cloud-sql-proxy-${var.env}"
  display_name = "Cloud SQL Proxy Service Account - ${var.env}"
  description  = "Service account for Cloud SQL Auth Proxy Cloud Run service"
}

# IAM role binding for Cloud SQL client access
resource "google_project_iam_member" "sql_proxy_client" {
  project = module.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.sql_proxy.email}"
}

# IAM role binding for Cloud SQL instance user
resource "google_project_iam_member" "sql_proxy_instance_user" {
  project = module.project.id
  role    = "roles/cloudsql.instanceUser"
  member  = "serviceAccount:${google_service_account.sql_proxy.email}"
}

# Grant Secret Manager access to Cloud SQL Proxy
resource "google_project_iam_member" "sql_proxy_secret_accessor" {
  project = module.project.id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.sql_proxy.email}"
}

# Cloud Run v2 Service for Cloud SQL Auth Proxy
resource "google_cloud_run_v2_service" "sql_proxy" {
  project  = module.project.id
  name     = "cloud-sql-proxy-${var.env}"
  location = var.region

  template {
    service_account = google_service_account.sql_proxy.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    vpc_access {
      connector = google_vpc_access_connector.vpc_connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      name  = "cloud-sql-proxy"
      image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0"

      args = [
        "--private-ip",
        "--address=0.0.0.0",
        "--port=5432",
        "--health-check",
        "--http-address=0.0.0.0",
        "--http-port=9090",
        module.cloudsql_instance.connection_name
      ]

      ports {
        name           = "h2c"
        container_port = 5432
      }

      resources {
        limits = {
          cpu    = "0.5"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      # Health check probe configuration
      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 3
        http_get {
          path = "/startup"
          port = 9090
        }
      }

      liveness_probe {
        initial_delay_seconds = 15
        timeout_seconds       = 5
        period_seconds        = 30
        failure_threshold     = 3
        http_get {
          path = "/liveness"
          port = 9090
        }
      }
    }

    timeout = "300s"
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  # Internal-only ingress - access via IAM authentication
  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  # Disable deletion protection to allow updates
  deletion_protection = false

  depends_on = [
    google_vpc_access_connector.vpc_connector,
    google_service_account.sql_proxy,
    google_project_iam_member.sql_proxy_client,
    google_project_iam_member.sql_proxy_instance_user,
    module.cloudsql_instance
  ]
}

# IAM policy to allow invoking the Cloud Run service from within the VPC
resource "google_cloud_run_service_iam_member" "sql_proxy_invoker" {
  project  = module.project.id
  location = var.region
  service  = google_cloud_run_v2_service.sql_proxy.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${module.project.number}-compute@developer.gserviceaccount.com"
}

# IAM policy to allow specific users to invoke the service
# Uses IAM authentication for secure access
resource "google_cloud_run_service_iam_member" "sql_proxy_user_invoker" {
  for_each = toset(split(",", var.sql_proxy_allowed_users))
  project  = module.project.id
  location = var.region
  service  = google_cloud_run_v2_service.sql_proxy.name
  role     = "roles/run.invoker"
  member   = "user:${trimspace(each.value)}"
}

# Output the Cloud SQL Proxy service URL for connecting
output "cloud_sql_proxy_url" {
  description = "Cloud SQL Proxy service URL for connecting to the database"
  value       = google_cloud_run_v2_service.sql_proxy.uri
}

# Output the local connection command
output "cloud_sql_proxy_local_command" {
  description = "Command to connect to Cloud SQL via the proxy service"
  value       = "cloud-sql-proxy --port=5432 ${module.cloudsql_instance.connection_name}"
}

# Output instructions for using the proxy
output "cloud_sql_proxy_instructions" {
  description = "Instructions for connecting through the Cloud SQL Proxy Cloud Run service"
  value       = <<-EOT
    To connect to the database through the Cloud SQL Proxy Cloud Run service:
    
    1. Authenticate with gcloud:
       gcloud auth login
    
    2. Set up port forwarding to the Cloud Run service:
       gcloud run services proxy ${google_cloud_run_v2_service.sql_proxy.name} --project=${module.project.id} --region=${var.region} --port=5432
    
    3. In another terminal, connect to PostgreSQL:
       psql "postgresql://${local.db_user}@localhost:5432/${local.db_name}"
    
    Note: You'll be prompted for the database password.
  EOT
}
