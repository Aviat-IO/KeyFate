module "artifact_registry" {
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/artifact-registry"
  project_id = module.project.id
  location   = var.region
  name       = "keyfate-registry"
  format     = { docker = { standard = {} } }

  labels = var.labels
}

# Grant Cloud Build permissions to push to the registry
resource "google_project_iam_member" "cloud_build_permissions" {
  project = module.project.id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${module.project.number}@cloudbuild.gserviceaccount.com"

  depends_on = [module.project]
}
