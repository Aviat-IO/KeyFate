module "frontend_secrets" {
  source     = "github.com/GoogleCloudPlatform/cloud-foundation-fabric//modules/secret-manager"
  project_id = module.project.id

  secrets = {
    db-url = {
      locations = [var.region]
    }
    encryption-key = {
      locations = [var.region]
    }
    google-client-id = {
      locations = [var.region]
    }
    google-client-secret = {
      locations = [var.region]
    }
    supabase-jwt-secret = {
      locations = [var.region]
    }
    supabase-service-role-key = {
      locations = [var.region]
    }
    stripe-secret-key = {
      locations = [var.region]
    }
    btcpay-api-key = {
      locations = [var.region]
    }
    btcpay-store-id = {
      locations = [var.region]
    }
    btcpay-webhook-secret = {
      locations = [var.region]
    }
  }

  versions = {
    db-url = {
      current = { enabled = true, data = var.db_url }
    }
    encryption-key = {
      current = { enabled = true, data = var.encryption_key }
    }
    google-client-id = {
      current = { enabled = true, data = var.google_client_id }
    }
    google-client-secret = {
      current = { enabled = true, data = var.google_client_secret }
    }
    supabase-jwt-secret = {
      current = { enabled = true, data = var.supabase_jwt_secret }
    }
    supabase-service-role-key = {
      current = { enabled = true, data = var.supabase_service_role_key }
    }
    stripe-secret-key = {
      current = { enabled = true, data = var.stripe_secret_key }
    }
    btcpay-api-key = {
      current = { enabled = true, data = var.btcpay_api_key }
    }
    btcpay-store-id = {
      current = { enabled = true, data = var.btcpay_store_id }
    }
    btcpay-webhook-secret = {
      current = { enabled = true, data = var.btcpay_webhook_secret }
    }
  }

  iam = {
    db-url = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    encryption-key = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    google-client-id = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    google-client-secret = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    supabase-jwt-secret = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    supabase-service-role-key = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    stripe-secret-key = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    btcpay-api-key = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    btcpay-store-id = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
    btcpay-webhook-secret = {
      "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
    }
  }
}
