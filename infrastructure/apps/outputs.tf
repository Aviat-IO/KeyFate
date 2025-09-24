output "project_id" {
  value = module.project.id
}

output "project_number" {
  value = module.project.number
}

output "cloud_run_service_url" {
  description = "The URL of the Cloud Run service"
  value       = module.cloud_run.service_uri
}

output "artifact_registry_url" {
  description = "The URL of the Artifact Registry"
  value       = module.artifact_registry.url
}

output "cron_secret_id" {
  description = "The Secret Manager ID for the cron authentication secret"
  value       = google_secret_manager_secret.cron_secret.id
}

output "cron_secret_name" {
  description = "The Secret Manager name for the cron authentication secret"
  value       = google_secret_manager_secret.cron_secret.name
}

output "cloud_scheduler_service_account_email" {
  description = "The email of the Cloud Scheduler service account"
  value       = module.cloud_scheduler_service_account.email
}
