variable "env" {
  description = "The environment to deploy to"
  type        = string
}

variable "project_id" {
  description = "The project ID to deploy to"
  type        = string
}

variable "region" {
  description = "The region to deploy to"
  type        = string
}

variable "labels" {
  description = "The labels to attach to all resources"
  type        = map(string)
}

variable "billing_account" {
  description = "The billing account to use for the project"
  type        = string
}

variable "organization_id" {
  description = "The organization ID to deploy to"
  type        = string
}

variable "folder_id" {
  description = "The folder ID to deploy to"
  type        = string
}

variable "frontend_dir" {
  description = "Absolute path to the frontend directory"
  type        = string
  default     = ""
}

# Cloud Run specific variables
variable "cpu_limit" {
  description = "CPU limit for the container"
  type        = string
  default     = "1000m"  # 1 vCPU
}

variable "memory_limit" {
  description = "Memory limit for the container"
  type        = string
  default     = "512Mi"  # Cloud Run requires 512Mi minimum with 1 vCPU
}

variable "cpu_boost" {
  description = "Enable CPU boost for faster cold starts"
  type        = bool
  default     = false  # Dev: false, Prod: true
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 3  # Dev: 3, Prod: 5
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated access to the service"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false  # Dev: false, Prod: true
}

# Public environment variables (NEXT_PUBLIC_*)
variable "next_public_site_url" {
  description = "Public site URL"
  type        = string
}

variable "next_public_company" {
  description = "Company name"
  type        = string
  default     = "KeyFate"
}

variable "next_public_parent_company" {
  description = "Parent company name"
  type        = string
}

variable "next_public_support_email" {
  description = "Support email address"
  type        = string
}

# Authentication service configuration (replacing Supabase)
variable "next_public_auth_provider" {
  description = "Authentication provider (e.g., 'google', 'custom')"
  type        = string
  default     = "google"
}

variable "next_public_database_provider" {
  description = "Database provider identifier"
  type        = string
  default     = "cloudsql"
}

# Secret variables (sensitive)
# variable "db_url" {
#   description = "Database connection URL"
#   type        = string
#   sensitive   = true
# }

variable "db_password" {
  description = "Database password for Cloud SQL user"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for application"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth.js secret for session encryption"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret API key"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret for verifying webhook events"
  type        = string
  sensitive   = true
}

variable "next_public_stripe_publishable_key" {
  description = "Stripe publishable key (public)"
  type        = string
}

variable "custom_domain" {
  description = "Custom domain for the Cloud Run service (e.g., staging.keyfate.com)"
  type        = string
  default     = ""
}

# BTCPay Server configuration (external hosting)
variable "btcpay_server_url" {
  description = "External BTCPay Server URL (e.g., https://btcpay.keyfate.com)"
  type        = string
  default     = ""
}

variable "btcpay_api_key" {
  description = "BTCPay Server API key for creating invoices"
  type        = string
  sensitive   = true
}

variable "btcpay_store_id" {
  description = "BTCPay Server store ID"
  type        = string
  sensitive   = true
}

variable "btcpay_webhook_secret" {
  description = "BTCPay Server webhook secret for verification"
  type        = string
  sensitive   = true
}

variable "cloudsql_enable_public_ip" {
  description = "Enable public IP for Cloud SQL instance (useful for development)"
  type        = bool
  default     = false  # Default to false for security, enable in dev/staging
}

variable "cloudsql_authorized_networks" {
  description = "Map of authorized networks for Cloud SQL public IP access"
  type        = map(string)
  default     = {}
  # Example:
  # {
  #   "office" = "203.0.113.0/32"
  #   "home"   = "198.51.100.0/32"
  # }
}

# SendGrid configuration
variable "sendgrid_api_key" {
  description = "SendGrid API key for sending emails"
  type        = string
  sensitive   = true
}

variable "sendgrid_sender_name" {
  description = "SendGrid sender name for outgoing emails"
  type        = string
  default     = "KeyFate"
}

variable "sendgrid_admin_email" {
  description = "SendGrid admin email address for notifications"
  type        = string
}

