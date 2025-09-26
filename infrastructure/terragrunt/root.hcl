locals {
  project_title = "KeyFate"
  project_name = "keyfate"
  project_prefix = ""
  region = "us-central1"
  tf_state_project_id = "aviat-terraform"
}

# Ultra-fast optimizations applied to all terragrunt configurations
terraform {
  # Ultra-fast optimizations applied automatically to all child configs
  extra_arguments "ultra_fast_plan" {
    commands = ["plan"]
    arguments = [
      "-parallelism=20",
      "-refresh=false"
    ]
  }

  extra_arguments "ultra_fast_init" {
    commands = ["init"]
    arguments = [
      "-upgrade=false"
    ]
  }

  extra_arguments "ultra_fast_apply" {
    commands = ["apply"]
    arguments = [
      "-parallelism=20"
    ]
  }
}
