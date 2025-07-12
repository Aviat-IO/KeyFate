# Apps

This is the directory to implement the actual Terraform corresponding to domains of the application. An "app" is like a service or core component of the deployment. Some examples include:

- Network
- Database
- Webapp
- Cache
- Data Warehouse

## Terraform

Your `terragrunt` directory will need to reference these apps in a relative manner

```tf
include {
  path = find_in_parent_folders()
}
```

This will allow you to use the apps in the `terragrunt/` directory

```tf
terraform {
  source "${get_repo_root()}/apps/webapp
}
```
