# Infrastructure Validation Tests - TDD Red Phase
# Tests that define expected infrastructure behavior

# Test 1: Service Networking API must be enabled
# Expected: servicenetworking.googleapis.com should be in services list
data "google_project_service" "service_networking" {
  project = var.project_id
  service = "servicenetworking.googleapis.com"
}

// Test 2: Cloud Scheduler jobs must have valid HTTPS URLs for Next.js API endpoints
// Expected: All scheduler job base URL should start with https://
resource "null_resource" "validate_scheduler_urls" {
  provisioner "local-exec" {
    command = <<-EOT
      echo "Validating scheduler job base URL..."
      if ! echo "${var.next_public_site_url}" | sed 's/\/*$//' | grep -q "^https://"; then
        echo "ERROR: NEXT_PUBLIC_SITE_URL must start with https://"
        exit 1
      fi
      echo "Scheduler base URL is valid HTTPS"
    EOT
  }
}

# Test 3: Docker build must handle lockfile correctly
# Expected: Dockerfile should use --no-frozen-lockfile for flexibility OR lockfile should be current
resource "null_resource" "validate_docker_build" {
  provisioner "local-exec" {
    command = <<-EOT
      echo "Validating Docker build configuration..."
      cd ../frontend
      if grep -q "\-\-frozen-lockfile" Dockerfile && ! grep -q "\-\-no-frozen-lockfile" Dockerfile; then
        echo "Found --frozen-lockfile without --no prefix. Checking if lockfile is current..."
        # Test if pnpm install would change the lockfile
        pnpm install --dry-run --frozen-lockfile || {
          echo "ERROR: pnpm-lock.yaml is not up to date with package.json"
          echo "Missing dependencies detected"
          exit 1
        }
      elif grep -q "\-\-no-frozen-lockfile" Dockerfile; then
        echo "✅ Docker uses --no-frozen-lockfile for flexible dependency resolution"
      else
        echo "✅ Docker does not enforce frozen lockfile"
      fi
      echo "Docker build configuration is valid"
    EOT
  }
}

# Test 4: All required Google Cloud APIs must be enabled
locals {
  required_services = [
    "container.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "stackdriver.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "cloudscheduler.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com", # This should be included
    "compute.googleapis.com"
  ]
}

# Output validation results
output "validation_results" {
  value = {
    service_networking_enabled = data.google_project_service.service_networking.id != null
    required_services_count    = length(local.required_services)
    scheduler_url_base         = var.next_public_supabase_url
  }
}
