# Google Cloud Scheduler Jobs for KeyFate Dead Man's Switch
# These jobs replace the manual trigger-reminders.sh script

locals {}

# Generate a random secret for cron authentication
resource "random_password" "cron_secret" {
  length  = 32
  special = true
  upper   = true
  lower   = true
  numeric = true
}

# Store the cron secret in Secret Manager
resource "google_secret_manager_secret" "cron_secret" {
  secret_id = "cron-authentication-secret-${var.env}"
  project   = module.project.id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "cron_secret" {
  secret      = google_secret_manager_secret.cron_secret.id
  secret_data = random_password.cron_secret.result
}

# Service account for Cloud Scheduler
module "cloud_scheduler_service_account" {
  source       = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/iam-service-account"
  project_id   = module.project.id
  name         = "cloud-scheduler-${var.env}"
  display_name = "Cloud Scheduler Service Account"
  description  = "Service account for Cloud Scheduler to invoke cron endpoints"

  # Grant necessary roles for Cloud Scheduler
  iam_project_roles = {
    "${module.project.id}" = [
      "roles/cloudscheduler.serviceAgent",
      "roles/secretmanager.secretAccessor",
      "roles/run.invoker"
    ]
  }
}

# Grant the Cloud Scheduler service account access to the cron secret
resource "google_secret_manager_secret_iam_member" "scheduler_secret_access" {
  project   = module.project.id
  secret_id = google_secret_manager_secret.cron_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.cloud_scheduler_service_account.email}"
}

# Also grant the frontend service account access to the cron secret
# (for validation in the API endpoints)
resource "google_secret_manager_secret_iam_member" "frontend_cron_secret_access" {
  project   = module.project.id
  secret_id = google_secret_manager_secret.cron_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.frontend_service_account.email}"
}

# Cloud Scheduler job to check and send reminders every 5 minutes
resource "google_cloud_scheduler_job" "process_reminders" {
  name        = "keyfate-process-reminders-${var.env}"
  description = "Check and send reminders for KeyFate dead man's switch"
  schedule    = "*/5 * * * *" # Every 5 minutes
  project     = module.project.id

  http_target {
    http_method = "POST"
    uri         = "${var.next_public_site_url}/api/cron/process-reminders"

    headers = {
      "Authorization" = "Bearer ${random_password.cron_secret.result}"
      "Content-Type"  = "application/json"
    }

    # OAuth token configuration to use the service account
    oidc_token {
      service_account_email = module.cloud_scheduler_service_account.email
      audience              = var.next_public_site_url
    }

    # Empty body for POST request
    body = base64encode("{}")
  }

  # Retry configuration
  retry_config {
    retry_count          = 3
    max_retry_duration   = "60s"
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
    max_doublings        = 2
  }

  # Timeout configuration
  time_zone = "UTC"

  depends_on = [
    google_secret_manager_secret_version.cron_secret,
    google_secret_manager_secret_iam_member.scheduler_secret_access
  ]
}

# Cloud Scheduler job to check and trigger secrets every 5 minutes
resource "google_cloud_scheduler_job" "check_secrets" {
  name        = "keyfate-check-secrets-${var.env}"
  description = "Check and trigger secrets for KeyFate dead man's switch"
  schedule    = "*/5 * * * *" # Every 5 minutes
  project     = module.project.id

  http_target {
    http_method = "POST"
    uri         = "${var.next_public_site_url}/api/cron/check-secrets"

    headers = {
      "Authorization" = "Bearer ${random_password.cron_secret.result}"
      "Content-Type"  = "application/json"
    }

    # OAuth token configuration to use the service account
    oidc_token {
      service_account_email = module.cloud_scheduler_service_account.email
      audience              = var.next_public_site_url
    }

    # Empty body for POST request
    body = base64encode("{}")
  }

  # Retry configuration
  retry_config {
    retry_count          = 3
    max_retry_duration   = "60s"
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
    max_doublings        = 2
  }

  # Timeout configuration
  time_zone = "UTC"

  depends_on = [
    google_secret_manager_secret_version.cron_secret,
    google_secret_manager_secret_iam_member.scheduler_secret_access
  ]
}
