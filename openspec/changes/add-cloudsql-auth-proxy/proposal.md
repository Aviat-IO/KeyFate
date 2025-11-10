# Add Cloud SQL Auth Proxy for Secure Database Connections

## Why

Production and staging Cloud SQL instances currently rely on public IP addresses
for Cloud Run to connect via Unix socket volumes. This is a security risk and
not a best practice. The Cloud SQL Auth Proxy provides:

1. **Security**: Encrypted TLS 1.3 connections without exposing public IPs or
   managing SSL certificates
2. **Authentication**: IAM-based authentication instead of static IP allowlists
3. **Simplicity**: Automatic connection management and certificate rotation
4. **Cost**: No VPC Connector required (~$36/month savings maintained)

Google Cloud documentation explicitly recommends Cloud SQL Auth Proxy for Cloud
Run connections when using private-only databases.

## What Changes

- **Remove** public IP requirement from Cloud SQL instances (set
  `ipv4Enabled: false`)
- **Remove** `cloudsql_enable_public_ip` variable and related authorized
  networks configuration
- **Keep** existing Cloud Run gen2 configuration with Unix socket volumes
- **Keep** existing IAM service account with `roles/cloudsql.client` permission
- **Update** database connection string in Secret Manager to use Cloud SQL
  connection name format
- **Document** that Cloud SQL Auth Proxy runs automatically via Cloud Run's
  built-in integration

## Impact

### Affected Infrastructure

- `infrastructure/apps/cloudsql.tf` - Remove public IP settings, update network
  config
- `infrastructure/apps/frontend.tf` - Connection already configured correctly
  with volumes
- `infrastructure/apps/variables.tf` - Remove `cloudsql_enable_public_ip` and
  `cloudsql_authorized_networks`
- `infrastructure/terragrunt/{staging,prod}/terraform.tfvars` - Remove public IP
  variables

### Affected Specs

- `infrastructure` spec - Add Cloud SQL Auth Proxy requirements

### Breaking Changes

None - this is a security improvement that maintains the same application
connectivity pattern. The Cloud SQL Auth Proxy integration is already configured
via:

1. Cloud Run gen2 execution environment
2. Cloud SQL instance connection in volumes section
3. Service account with `roles/cloudsql.client` permission

### Migration Path

1. Remove `cloudsql_enable_public_ip = true` from `terraform.tfvars`
2. Apply Terraform changes to disable public IP on Cloud SQL instances
3. Verify Cloud Run continues to connect via Unix socket (no application changes
   needed)
4. Remove authorized networks configuration (no longer needed)

### Security Benefits

- Database instances no longer have public IPs
- No IP allowlists to manage
- Automatic TLS encryption and certificate rotation
- IAM-based authentication
- Reduced attack surface

### References

- [Cloud SQL Auth Proxy Documentation](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Connect from Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud Run gen2 with Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-instance-cloud-run)
