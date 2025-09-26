locals {
  project_title = "KeyFate"
  project_name = "keyfate"
  project_prefix = ""
  region = "us-central1"
  tf_state_project_id = "aviat-terraform"
}

# Ultra-fast optimizations applied to all terragrunt configurations
terraform {
  # Maximum speed optimizations for all operations
  extra_arguments "ultra_fast_init" {
    commands = ["init"]
    arguments = [
      "-upgrade=false",
      "-backend=true",
      "-get=true",
      "-input=false"
    ]
  }

  extra_arguments "ultra_fast_apply" {
    commands = ["apply"]
    arguments = [
      "-parallelism=50",
      "-refresh=false",
      "-compact-warnings"
    ]
  }

  extra_arguments "ultra_fast_plan" {
    commands = ["plan"]
    arguments = [
      "-parallelism=50",
      "-refresh=false",
      "-compact-warnings"
    ]
  }

  extra_arguments "ultra_fast_destroy" {
    commands = ["destroy"]
    arguments = [
      "-parallelism=50",
      "-refresh=false"
    ]
  }
}
