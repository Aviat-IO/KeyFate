# Bastion Host for secure database access
# Provides SSH tunnel access to Cloud SQL via Cloud SQL Auth Proxy

# Service Account for Bastion Host
resource "google_service_account" "bastion" {
  project      = module.project.id
  account_id   = "bastion-${var.env}"
  display_name = "Bastion Host Service Account - ${var.env}"
  description  = "Service account for bastion host with Cloud SQL access"
}

# IAM role bindings for Cloud SQL access
resource "google_project_iam_member" "bastion_cloudsql_client" {
  project = module.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.bastion.email}"
}

resource "google_project_iam_member" "bastion_instance_user" {
  project = module.project.id
  role    = "roles/cloudsql.instanceUser"
  member  = "serviceAccount:${google_service_account.bastion.email}"
}

# Grant Cloud SQL Admin API viewer permissions (for v1 proxy auto-discovery)
resource "google_project_iam_member" "bastion_cloudsql_viewer" {
  project = module.project.id
  role    = "roles/cloudsql.viewer"
  member  = "serviceAccount:${google_service_account.bastion.email}"
}

# Firewall rule to allow SSH access to bastion host
resource "google_compute_firewall" "bastion_ssh" {
  project     = module.project.id
  name        = "allow-ssh-bastion-${var.env}"
  network     = module.vpc.name
  description = "Allow SSH access to bastion host from IAP"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # Allow SSH from Identity-Aware Proxy (IAP)
  # IAP IP range: 35.235.240.0/20
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["bastion-${var.env}"]
}

# Firewall rule to allow SQL proxy port forwarding
resource "google_compute_firewall" "bastion_sql_proxy" {
  project     = module.project.id
  name        = "allow-sql-proxy-bastion-${var.env}"
  network     = module.vpc.name
  description = "Allow SQL proxy port forwarding on bastion host"

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  # Allow from IAP for tunneling
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["bastion-${var.env}"]
}

# Bastion Host Compute Instance
module "bastion_host" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/compute-vm"
  project_id = module.project.id
  zone       = "${var.region}-a"
  name       = "bastion-host"

  # Cost-optimized instance type - f1-micro for dev, g1-small for prod
  instance_type = var.env == "prod" ? "g1-small" : "f1-micro"

  # Boot disk configuration
  boot_disk = {
    initialize_params = {
      image = "projects/debian-cloud/global/images/family/debian-12"
      type  = "pd-standard"
      size  = 10 # 10 GB standard disk
    }
  }

  # Network configuration
  network_interfaces = [
    {
      network    = module.vpc.self_link
      subnetwork = module.vpc.subnet_self_links["${var.region}/keyfate-subnet-${var.env}"]
      # No external IP - access via IAP only
      nat       = false
      addresses = null
      alias_ips = null
      nic_type  = null
    }
  ]

  # Service account with Cloud SQL access
  service_account = {
    email       = google_service_account.bastion.email
    scopes      = ["cloud-platform"]
    auto_create = false
  }

  # Network tags for firewall rules
  tags = ["bastion-${var.env}"]

  # Metadata with startup script to install Cloud SQL Proxy
  metadata = {
    enable-oslogin = "TRUE"
    startup-script = <<-EOF
      #!/bin/bash
      # Install Cloud SQL Proxy v2
      curl -o /usr/local/bin/cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.linux.amd64
      chmod +x /usr/local/bin/cloud-sql-proxy
      
      # Install PostgreSQL client tools
      apt-get update
      apt-get install -y postgresql-client
      
      # Create systemd service for Cloud SQL Proxy v2
      cat > /etc/systemd/system/cloud-sql-proxy.service <<EOF_SYSTEMD
[Unit]
Description=Cloud SQL Proxy v2
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloud-sql-proxy --address 0.0.0.0 --port 5432 --private-ip ${module.cloudsql_instance.connection_name}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF_SYSTEMD
      
      # Enable and start the service automatically on boot
      systemctl daemon-reload
      systemctl enable cloud-sql-proxy.service
      systemctl start cloud-sql-proxy.service
    EOF
  }

  labels = merge(var.labels, {
    role = "bastion"
    env  = var.env
  })

  # Deletion protection for production
  options = {
    deletion_protection = var.deletion_protection
  }
}

# Output bastion host information
output "bastion_host_info" {
  description = "Bastion host connection information"
  sensitive   = true
  value = {
    instance_name      = module.bastion_host.instance.name
    instance_zone      = module.bastion_host.instance.zone
    internal_ip        = module.bastion_host.internal_ip
    service_account    = google_service_account.bastion.email
    connection_name    = module.cloudsql_instance.connection_name
    ssh_command        = "gcloud compute ssh --zone=${var.region}-a bastion-host --project=${var.project_id} --tunnel-through-iap"
    proxy_command      = "cloud-sql-proxy --port 5432 ${module.cloudsql_instance.connection_name}"
    tunnel_command     = "gcloud compute ssh --zone=${var.region}-a bastion-host --project=${var.project_id} --tunnel-through-iap --ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'"
    psql_command       = "psql \"postgresql://${local.db_user}@localhost:54321/${local.db_name}\""
    migration_command  = "npm run db:migrate -- --config=drizzle-${var.env}.config.ts"
  }
}
