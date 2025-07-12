include {
  path = find_in_parent_folders("root.hcl")
}

locals {
  environment = "dev"
  root_config = read_terragrunt_config(find_in_parent_folders("root.hcl"))
  project_id = "${local.root_config.locals.project_prefix}${local.root_config.locals.project_name}-${local.environment}"
  tf_state_project_id = local.root_config.locals.tf_state_project_id
}

terraform {
  source = "../../apps"
}

generate "provider" {
  path = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents = <<EOF
  provider "google" {
    project = "${local.project_id}"
    region = "${local.root_config.locals.region}"
    billing_project = "${local.tf_state_project_id}"
    user_project_override = true
  }
  EOF
}

remote_state {
  backend = "gcs"
  config = {
    location = "us"
    project = "${local.tf_state_project_id}"
    bucket = "${local.tf_state_project_id}-tfstate"
    prefix = "${local.root_config.locals.project_name}/${local.environment}/terraform.tfstate"
  }
}

inputs = {
  env = local.environment
  labels = {
    env = local.environment
    project = local.root_config.locals.project_name
  }
  project_id = local.project_id
  project_name = local.root_config.locals.project_name
  project_title = local.root_config.locals.project_title
  region = local.root_config.locals.region

  # These will be populated from terraform.tfvars
  # billing_account, organization_id, folder_id are required
  # Cloud Run variables will come from terraform.tfvars
}
