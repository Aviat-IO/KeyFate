terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.47.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 6.47.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.1.0"
    }
    external = {
      source  = "hashicorp/external"
      version = ">= 2.0.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.0.0"
    }
  }
}