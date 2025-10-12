module "frontend_secrets" {
  source     = "git::https://github.com/GoogleCloudPlatform/cloud-foundation-fabric.git//modules/secret-manager"
  project_id = module.project.id

  secrets = {
    encryption-key = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.encryption_key }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    google-client-id = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.google_client_id }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    google-client-secret = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.google_client_secret }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    nextauth-secret = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.nextauth_secret }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    stripe-secret-key = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.stripe_secret_key }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    stripe-webhook-secret = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.stripe_webhook_secret }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    btcpay-api-key = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.btcpay_api_key }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    btcpay-store-id = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.btcpay_store_id }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    btcpay-webhook-secret = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.btcpay_webhook_secret }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
    sendgrid-api-key = {
      # Remove regional location to use global automatic replication
      versions = {
        current = { enabled = true, data = var.sendgrid_api_key }
      }
      iam = {
        "roles/secretmanager.secretAccessor" = ["serviceAccount:${module.frontend_service_account.email}"]
      }
    }
  }
}
