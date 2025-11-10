# Cloud SQL Auth Proxy Integration Design

## Context

The KeyFate application runs on Cloud Run and connects to Cloud SQL PostgreSQL
instances. Currently, both staging and production Cloud SQL instances have
public IPs enabled to allow Cloud Run to connect via the built-in Cloud SQL
integration (Unix socket volumes). This violates security best practices.

### Current Architecture

- Cloud Run gen2 with Cloud SQL volume mount at `/cloudsql`
- Cloud SQL instances with both private IP (VPC peering) AND public IP
- Service account with `roles/cloudsql.client` permission
- DATABASE_URL using Unix socket format

### Stakeholders

- Security: Reduce attack surface by eliminating public IPs
- Operations: Simplify connection management
- Development: Maintain existing connection patterns

## Goals / Non-Goals

### Goals

- Remove public IPs from Cloud SQL instances
- Maintain existing Unix socket connection pattern
- Leverage Cloud Run's built-in Cloud SQL Auth Proxy integration
- No application code changes required
- No additional infrastructure costs

### Non-Goals

- Deploy standalone Cloud SQL Auth Proxy containers (Cloud Run handles this)
- Implement VPC Connector (costs ~$36/month, unnecessary with built-in proxy)
- Change application database connection logic
- Add connection pooling at proxy level (use application-level pooling)

## Architecture Decision

### Use Cloud Run's Built-in Cloud SQL Auth Proxy

Cloud Run gen2 automatically provides Cloud SQL Auth Proxy functionality when:

1. **Execution environment** is set to `gen2`
2. **Cloud SQL connection** is specified in the volumes configuration
3. **Service account** has `roles/cloudsql.client` permission
4. **DATABASE_URL** uses Unix socket format:
   `postgresql://user:pass@/db?host=/cloudsql/PROJECT:REGION:INSTANCE`

When these conditions are met, Cloud Run automatically:

- Injects a Cloud SQL Auth Proxy sidecar process
- Mounts Unix sockets at `/cloudsql/PROJECT:REGION:INSTANCE/.s.PGSQL.5432`
- Handles TLS encryption and IAM authentication
- Manages certificate rotation

**Our infrastructure already has all four requirements configured.** We only
need to disable public IPs.

### Why Not Manual Cloud SQL Auth Proxy Deployment?

| Approach                 | Pros                                                       | Cons                                                          |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **Built-in (Chosen)**    | Free, automatic, no maintenance, integrated with Cloud Run | None for our use case                                         |
| Sidecar container        | Fine-grained control                                       | Extra container, added complexity, manual updates             |
| Standalone proxy service | Shared across apps                                         | Additional service to maintain, cost, single point of failure |
| VPC Connector            | Direct VPC access                                          | $36/month cost, manual networking config                      |

### Connection Flow

```
Application Process
  ↓ (local Unix socket)
Cloud Run Pod: Cloud SQL Auth Proxy Sidecar (automatic)
  ↓ (encrypted TLS 1.3)
Cloud SQL Instance (private IP only)
```

## Technical Decisions

### 1. Database Connection String

**Current (correct format):**

```
postgresql://keyfate_app:PASSWORD@/keyfate?host=/cloudsql/keyfate-prod:us-central1:keyfate-postgres-production
```

**Decision:** Keep existing format. Cloud Run's built-in proxy creates the Unix
socket at exactly this path.

### 2. IAM Permissions

**Required permissions:**

- `roles/cloudsql.client` - Already granted to frontend service account

**Decision:** No changes needed. Current permissions are correct.

### 3. Network Configuration

**Current:**

- Private IP via VPC peering (used for internal access)
- Public IP enabled (to be removed)

**Decision:**

- Keep private IP with VPC peering
- Disable public IP (`public_ipv4 = false`)
- Remove authorized networks (no longer needed)

### 4. Monitoring Connection Health

Cloud Run automatically monitors the Cloud SQL Auth Proxy sidecar. Connection
failures appear in:

- Cloud Run logs (application container)
- Cloud Audit Logs (IAM authentication events)
- Cloud SQL logs (connection attempts)

**Decision:** Use existing Cloud Run and Cloud SQL monitoring. No additional
infrastructure needed.

## Alternatives Considered

### Alternative 1: Keep Public IP with Authorized Networks

**Rejected because:**

- Larger attack surface (database exposed to internet)
- Manual IP allowlist management
- Doesn't follow Google Cloud best practices
- No cost or operational benefit

### Alternative 2: VPC Connector

**Rejected because:**

- Additional cost (~$36/month)
- Manual networking configuration
- Cloud Run's built-in proxy provides same functionality for free
- More complex troubleshooting

### Alternative 3: Private Service Connect

**Rejected because:**

- Over-engineered for single-project use case
- Additional configuration complexity
- Built-in Cloud Run integration is simpler

## Migration Plan

### Phase 1: Staging Environment (Week 1)

1. Remove `cloudsql_enable_public_ip` from staging tfvars
2. Apply Terraform to disable public IP
3. Verify application connectivity (should continue working)
4. Monitor for 24 hours

### Phase 2: Production Environment (Week 2)

1. Remove `cloudsql_enable_public_ip` from prod tfvars
2. Apply Terraform during maintenance window
3. Verify application connectivity
4. Monitor for 48 hours

### Rollback Plan

If connectivity fails:

1. Re-enable public IP via Terraform variable
2. Apply Terraform (5-10 minute operation)
3. Investigate Cloud Run logs and service account permissions

### Success Criteria

- Application successfully connects to database
- No public IP visible on Cloud SQL instance
- Cloud Run logs show successful database queries
- No increase in connection errors

## Risks / Trade-offs

### Risk: Cloud Run Built-in Proxy Configuration Error

**Likelihood:** Low (infrastructure already configured correctly)\
**Impact:** High (database connectivity lost)\
**Mitigation:**

- Test in staging first
- Verify all four requirements before disabling public IP
- Maintain rollback capability
- Deploy during low-traffic period

### Risk: Unexpected Firewall Rules

**Likelihood:** Very Low (Unix socket is local to pod)\
**Impact:** Medium (intermittent connectivity)\
**Mitigation:**

- Cloud SQL Auth Proxy uses outbound HTTPS (port 443) only
- No inbound firewall rules needed
- Document required egress: port 443 to `sqladmin.googleapis.com`, port 3307 to
  Cloud SQL private IP

### Trade-off: Debugging Complexity

**Trade-off:** Built-in proxy has less verbose logging than standalone\
**Mitigation:**

- Enable Cloud SQL query logging if needed
- Use Cloud Trace for connection timing
- Document common troubleshooting steps

## Open Questions

None - all requirements validated against current infrastructure configuration.

## Implementation Notes

### Verification Checklist

Before disabling public IP, confirm:

- [ ] `run.googleapis.com/execution-environment: gen2` annotation exists
- [ ] Cloud SQL instance in volumes:
      `cloud_sql_instances = [module.cloudsql_instance.connection_name]`
- [ ] Volume mount: `volume_mounts = { cloudsql = "/cloudsql" }`
- [ ] Service account has `roles/cloudsql.client`
- [ ] DATABASE_URL uses `/cloudsql/PROJECT:REGION:INSTANCE` format

All checkboxes already verified in current `frontend.tf` and `cloudsql.tf`.

### Troubleshooting

**Symptom:** Connection refused\
**Solution:** Verify gen2 annotation and Cloud SQL volume configuration

**Symptom:** Authentication failed\
**Solution:** Verify service account has `roles/cloudsql.client`

**Symptom:** Timeout connecting\
**Solution:** Check Cloud SQL instance is in same region, verify private IP
peering

### References

- [Cloud Run Cloud SQL Connections](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL Auth Proxy Overview](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Cloud Run gen2 Execution Environment](https://cloud.google.com/run/docs/about-execution-environments)
