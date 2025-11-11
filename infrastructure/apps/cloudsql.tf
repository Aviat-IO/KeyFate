# Google Cloud SQL PostgreSQL instance for KeyFate
# Replaces Supabase with managed PostgreSQL on Google Cloud

locals {
  db_name     = "keyfate"
  db_user     = "keyfate_app"
  db_instance = "keyfate-postgres-${var.env}"
}

# VPC for private IP connectivity to Cloud SQL
module "vpc" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/net-vpc"
  project_id = module.project.id
  name       = "keyfate-vpc-${var.env}"

  subnets = [
    {
      name                  = "keyfate-subnet-${var.env}"
      region                = var.region
      ip_cidr_range         = "10.0.0.0/24"
      enable_private_access = true
    }
  ]
}

# Private service connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  project       = module.project.id
  name          = "keyfate-private-ip-${var.env}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = module.vpc.self_link
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = module.vpc.self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Random password for database user
# Database password is now provided via terraform.tfvars
# Use var.db_password instead of generating a random password

# Cloud SQL PostgreSQL instance
module "cloudsql_instance" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/cloudsql-instance"
  project_id = module.project.id
  name       = local.db_instance
  region     = var.region

  database_version = "POSTGRES_17"
  # Cost-optimized instance sizes
  # Dev/Staging: db-f1-micro (shared CPU, 0.6 GB RAM, ~$7/month)
  # Prod: db-g1-small (shared CPU, 1.7 GB RAM, ~$25/month) or db-standard-1 (1 vCPU, 3.75 GB RAM, ~$50/month)
  tier = var.env == "prod" ? "db-g1-small" : "db-f1-micro"

  terraform_deletion_protection = var.deletion_protection

  # Availability configuration - ZONAL for dev/staging (no HA), REGIONAL for prod (HA)
  availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"

  databases = [local.db_name]

  # Remove users from module to avoid for_each sensitivity issues
  # Create users separately below
  users = {}

  network_config = {
    connectivity = {
      public_ipv4 = false # Private-only: Use Cloud SQL Auth Proxy via Cloud Run built-in integration
      psa_config = {
        private_network = module.vpc.self_link
        allocated_ip_ranges = {
          primary = google_compute_global_address.private_ip_address.name
        }
      }
    }
  }

  # Cost-optimized backup configuration
  backup_configuration = {
    enabled                        = true
    start_time                     = "02:00"
    location                       = var.region
    point_in_time_recovery_enabled = var.env == "prod" ? true : false # Disable PITR for dev
    retention_count                = var.env == "prod" ? 7 : 1        # Minimal retention for dev
    log_retention_days             = var.env == "prod" ? 7 : 1        # Minimal log retention for dev
    transaction_log_retention_days = var.env == "prod" ? 7 : 1        # Minimal transaction log retention
  }

  # Remove problematic flags for now - will add back once instance is created
  flags = {}

  # Disable insights for cost optimization (only enable in prod if needed)
  insights_config = var.env == "prod" ? {
    record_application_tags = false # Disabled for cost optimization
    record_client_address   = false # Disabled for cost optimization
  } : null

  maintenance_config = {
    maintenance_window = {
      day  = 1 # Sunday
      hour = 3 # 3 AM
    }
  }

  ssl = {
    mode = "ALLOW_UNENCRYPTED_AND_ENCRYPTED" # Allow both SSL and non-SSL connections
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Create database user separately to avoid for_each sensitivity issues
resource "google_sql_user" "keyfate_app" {
  project  = module.project.id
  instance = module.cloudsql_instance.name
  name     = local.db_user
  password = var.db_password
  type     = "BUILT_IN"
}

# Store database credentials in Secret Manager
resource "google_secret_manager_secret" "database_url" {
  project   = module.project.id
  secret_id = "database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  # Use Unix socket for reliable connection (avoiding VPC connector issues)
  # Cloud Run v2 with explicit Cloud SQL connection mounts Unix socket at /cloudsql
  # Format: postgresql://username:password@/database?host=/cloudsql/CONNECTION_NAME
  secret_data = "postgresql://${local.db_user}:${var.db_password}@/${local.db_name}?host=/cloudsql/${module.cloudsql_instance.connection_name}"
}

# Alternative connection secrets removed - only using Unix socket connection
# Unix socket is the recommended method for Cloud Run to Cloud SQL connections

# Cloud SQL Auth Proxy service account (for connection pooling if needed)
module "cloudsql_proxy_service_account" {
  source       = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/iam-service-account"
  project_id   = module.project.id
  name         = "cloudsql-proxy-${var.env}"
  display_name = "Cloud SQL Proxy Service Account"
  description  = "Service account for Cloud SQL Auth Proxy connections"

  iam_project_roles = {
    "${module.project.id}" = [
      "roles/cloudsql.client",
      "roles/cloudsql.instanceUser"
    ]
  }
}

# Update the frontend service account to include Cloud SQL client role
resource "google_project_iam_member" "frontend_cloudsql_client" {
  project = module.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${module.frontend_service_account.email}"
}

# Grant frontend service account access to database-url secret
resource "google_secret_manager_secret_iam_member" "database_url_accessor" {
  project   = module.project.id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.frontend_service_account.email}"
}

# VPC Access Connector for Cloud Run to access private Cloud SQL via Cloud SQL Auth Proxy
resource "google_vpc_access_connector" "vpc_connector" {
  project       = module.project.id
  name          = "keyfate-vpc-${var.env}"
  region        = var.region
  network       = module.vpc.name
  ip_cidr_range = "10.1.0.0/28"              # /28 gives 16 IPs, sufficient for Cloud Run connector
  machine_type  = "e2-micro"                 # Cost-effective instance type
  min_instances = 2                          # Minimum required by Google Cloud (same for dev and prod)
  max_instances = var.env == "prod" ? 10 : 5 # Scale up to 10 in prod, 5 in dev/staging

  depends_on = [module.vpc]
}

# Firewall rule to allow Cloud Run to connect to Cloud SQL via private IP
resource "google_compute_firewall" "allow_cloudsql" {
  project     = module.project.id
  name        = "allow-cloudsql-${var.env}"
  network     = module.vpc.name
  description = "Allow Cloud Run to connect to Cloud SQL"

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  source_ranges = [
    "10.0.0.0/24", # Main subnet
    "10.1.0.0/28"  # VPC connector subnet
  ]
  target_tags = ["cloudsql"]
}

# Outputs for reference
output "cloudsql_info" {
  value = {
    instance_name    = module.cloudsql_instance.name
    instance_ip      = module.cloudsql_instance.ip
    public_ip        = "Disabled - using Cloud SQL Auth Proxy"
    database_name    = local.db_name
    database_user    = local.db_user
    connection_name  = module.cloudsql_instance.connection_name
    vpc_network      = module.vpc.name
    private_ip_range = google_compute_global_address.private_ip_address.address
  }
  description = "Cloud SQL instance information"
  sensitive   = true
}
