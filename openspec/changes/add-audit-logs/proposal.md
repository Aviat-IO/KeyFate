## Why

Pro users managing sensitive secrets need comprehensive audit trails for security, compliance, and troubleshooting. Tracking all secret-related activities provides transparency and accountability.

## What Changes

- Create `audit_logs` database table to track all user and system activities
- Log events: secret created/edited/deleted, check-ins, settings changes, recipient added/removed, secret triggered, login attempts, subscription changes
- Restrict audit log access to Pro tier users only
- Create audit log viewer UI component (Pro only)
- Add audit log API endpoints with Pro tier validation
- Store logs indefinitely (no automatic deletion)
- Include ability for Pro users to export audit logs

## Impact

- Affected specs: audit-logging (new)
- Affected code:
  - Database: new `audit_logs` table in schema
  - New migration: create audit_logs table
  - Audit logging service/utility for consistent logging
  - API endpoints: GET /api/audit-logs, GET /api/audit-logs/export
  - UI: new AuditLogsPage component
  - Update all secret operations to log events
  - `frontend/src/constants/pro-features.ts` (add audit logs feature)
