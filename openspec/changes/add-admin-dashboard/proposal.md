## Why

Operators have no visibility into system health, user activity, or problematic
secrets without querying the database directly. Failed secrets, email delivery
issues, and usage trends are invisible until users report problems. An admin
dashboard consolidates operational metrics and surfaces actionable problems.

## What Changes

- Add new `/admin` authenticated route with role-based access (admin token or
  admin user flag)
- Add admin API endpoints for aggregated metrics (secrets by status, user
  counts, email delivery stats, cron health)
- Add admin dashboard page with summary cards, failed secrets list, email
  failure queue, and cron job status
- Add admin-specific server-side data loading

## Impact

- Affected specs: `monitoring` (extends with admin visibility layer), new
  `admin-dashboard` capability
- Affected code:
  - New routes: `src/routes/admin/` (dashboard page + layout)
  - New API: `src/routes/api/admin/metrics/` (aggregated stats endpoint)
  - Modified: `src/lib/db/queries/` (new admin query functions)
  - Modified: `src/lib/db/schema.ts` (potential admin role field on users table)
  - Existing: `src/routes/api/admin/email-failures/` (already exists, will be
    surfaced in dashboard)
