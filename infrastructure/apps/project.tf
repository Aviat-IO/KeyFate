module "project" {
  source          = "github.com/GoogleCloudPlatform/cloud-foundation-fabric/modules/project"
  billing_account = var.billing_account
  name            = var.project_id

  # parent = "folders/${var.folder_id}"
  parent = "organizations/${var.organization_id}"

  services = [
    "container.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "stackdriver.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "cloudscheduler.googleapis.com",
  ]
}
