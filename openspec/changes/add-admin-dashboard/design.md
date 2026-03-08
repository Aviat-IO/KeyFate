## Context

KeyFate currently has admin API endpoints for email failures (IP-whitelisted +
bearer token auth) but no admin UI. Operators must query the database directly
or check Railway logs to understand system health. The admin dashboard provides
a single pane of glass for operational visibility.

## Goals / Non-Goals

- Goals:
  - Surface system health metrics at a glance (secrets by status, user counts,
    email delivery rates)
  - Show actionable problem lists (failed secrets, stuck cron jobs, email
    failures)
  - Provide admin actions on problem items (retry failed emails, view secret
    details)
  - Authenticate admins via existing ADMIN_TOKEN mechanism or user-level admin
    flag

- Non-Goals:
  - User management (create/delete users, impersonation)
  - Secret content access (zero-knowledge architecture is inviolate)
  - Real-time streaming/websocket updates (polling is sufficient)
  - Multi-tenant admin (single operator dashboard)
  - Custom alerting rules (use Sentry/external monitoring for that)

## Decisions

- **Auth approach: Session-based admin flag on users table.** Admin users
  authenticate normally (Google OAuth or credentials) then gain admin access if
  `users.isAdmin = true`. This avoids a separate auth flow and leverages
  existing session infrastructure. The existing IP-whitelist + bearer token
  approach for API-only endpoints remains for external tooling.
  - Alternatives considered: (1) Separate admin login page with ADMIN_TOKEN —
    adds complexity, poor UX. (2) IP whitelist only — too restrictive for
    mobile/VPN access.

- **Route structure: `/admin` route group with its own layout.** Uses
  SvelteKit's route grouping (`src/routes/(admin)/admin/`) with a layout guard
  that checks `session.user.isAdmin`. Separate from `(authenticated)` group to
  avoid polluting user navigation.
  - Alternatives considered: (1) Same `(authenticated)` group with conditional
    nav — clutters user experience. (2) Entirely separate app — over-engineered.

- **Metrics computation: On-demand aggregation queries, no materialized views.**
  At current scale (<1000 users), aggregating from source tables is fast enough.
  Add caching or materialized views only when performance data shows need.
  - Alternatives considered: (1) Cron-computed metrics table — adds complexity
    and staleness. (2) External analytics (Posthog) — introduces dependency.

- **Dashboard layout: Single page with tabbed sections.** Overview tab (summary
  cards), Problems tab (failed secrets + email failures), System tab (cron
  status + recent activity). Avoids premature page splitting.

## Risks / Trade-offs

- **Admin flag in users table** — requires a migration. Low risk; single boolean
  column, default false. Migration:
  `ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`.
- **Query performance** — aggregate queries on secrets/disclosure_log could slow
  down as data grows. Mitigation: add indexes on `status` columns, implement
  pagination, add `LIMIT` to all queries.
- **Security surface** — admin routes expose aggregate data. Mitigation: no
  secret content is ever exposed; only metadata (counts, statuses, timestamps).
  Layout guard + API middleware both check admin flag.

## Migration Plan

1. Add `isAdmin` boolean column to users table (default false)
2. Set admin flag for initial admin user(s) via direct DB update or seed script
3. Deploy admin routes behind the flag
4. No rollback needed — admin routes are additive, flag defaults to false

## Open Questions

- Should admin access be logged to the audit trail? (Recommend: yes)
- Should there be a way to grant admin access from the dashboard itself?
  (Recommend: no, DB-only for now)
- Should the email failures admin API be migrated from bearer token auth to
  session auth? (Recommend: support both, session for dashboard, token for
  external tooling)
