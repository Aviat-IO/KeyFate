module "artifact_registry" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/artifact-registry"
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

# Grant Compute Engine service account access to Cloud Storage (used by Cloud Build)
resource "google_project_iam_member" "compute_storage_access" {
  project = module.project.id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${module.project.number}-compute@developer.gserviceaccount.com"

  depends_on = [module.project]
}

# Grant Compute Engine service account access to the Cloud Build bucket
resource "google_storage_bucket_iam_member" "compute_cloudbuild_bucket_access" {
  bucket = "${module.project.id}_cloudbuild"
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${module.project.number}-compute@developer.gserviceaccount.com"

  depends_on = [module.project]
}

# Grant Compute Engine service account access to Artifact Registry (used by Cloud Build)
resource "google_project_iam_member" "compute_artifact_registry_access" {
  project = module.project.id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${module.project.number}-compute@developer.gserviceaccount.com"

  depends_on = [module.project]
}
