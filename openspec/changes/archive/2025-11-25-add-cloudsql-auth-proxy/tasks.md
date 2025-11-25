# Implementation Tasks

## 1. Infrastructure Changes

- [ ] 1.1 Remove `cloudsql_enable_public_ip` variable from
      `infrastructure/apps/variables.tf`
- [ ] 1.2 Remove `cloudsql_authorized_networks` variable from
      `infrastructure/apps/variables.tf`
- [ ] 1.3 Update `infrastructure/apps/cloudsql.tf` to disable public IP
      (`public_ipv4 = false`)
- [ ] 1.4 Remove authorized_networks configuration from Cloud SQL network_config
- [ ] 1.5 Remove `CLOUDSQL_AUTHORIZED_NETWORKS` env var from
      `infrastructure/apps/frontend.tf`

## 2. Configuration Updates

- [ ] 2.1 Remove `cloudsql_enable_public_ip = true` from
      `infrastructure/terragrunt/staging/terraform.tfvars`
- [ ] 2.2 Remove `cloudsql_enable_public_ip = true` from
      `infrastructure/terragrunt/prod/terraform.tfvars`
- [ ] 2.3 Remove any `cloudsql_authorized_networks` entries from tfvars files

## 3. Verification

- [ ] 3.1 Verify Cloud Run service has gen2 execution environment annotation
- [ ] 3.2 Verify Cloud Run service has Cloud SQL volume mounted at `/cloudsql`
- [ ] 3.3 Verify service account has `roles/cloudsql.client` permission
- [ ] 3.4 Verify DATABASE_URL uses Unix socket format:
      `postgresql://user:pass@/db?host=/cloudsql/CONNECTION_NAME`

## 4. Deployment & Testing

- [ ] 4.1 Apply Terraform changes to staging environment
- [ ] 4.2 Test staging application database connectivity
- [ ] 4.3 Verify no public IP exists on staging Cloud SQL instance
- [ ] 4.4 Apply Terraform changes to production environment
- [ ] 4.5 Test production application database connectivity
- [ ] 4.6 Verify no public IP exists on production Cloud SQL instance

## 5. Documentation

- [ ] 5.1 Update infrastructure README with Cloud SQL Auth Proxy explanation
- [ ] 5.2 Document that Cloud SQL Auth Proxy runs automatically via Cloud Run
      integration
- [ ] 5.3 Document troubleshooting steps for connection issues
- [ ] 5.4 Remove references to public IP from deployment documentation
