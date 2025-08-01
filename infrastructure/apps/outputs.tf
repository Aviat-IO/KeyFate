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
