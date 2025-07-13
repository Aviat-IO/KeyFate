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

output "cloud_run_service_name" {
  description = "The name of the Cloud Run service"
  value       = module.cloud_run.service_name
}

output "artifact_registry_url" {
  description = "The URL of the Artifact Registry"
  value       = module.artifact_registry.url
}

output "frontend_service_account_email" {
  description = "The email of the frontend service account"
  value       = module.frontend_service_account.email
}

output "domain_mapping_url" {
  description = "The custom domain URL (if configured)"
  value       = var.custom_domain != "" ? "https://${var.custom_domain}" : "Not configured"
}

output "domain_mapping_status" {
  description = "The status of the domain mapping"
  value       = var.custom_domain != "" ? google_cloud_run_domain_mapping.frontend_domain[0].status : null
}
