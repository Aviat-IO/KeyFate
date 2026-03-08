## 1. Database Schema

- [ ] 1.1 Add `isAdmin` boolean column to users table in `schema.ts`
- [ ] 1.2 Run `bunx drizzle-kit generate --name="add_is_admin_column"`
- [ ] 1.3 Test migration locally with `bunx drizzle-kit migrate`

## 2. Admin Auth Middleware

- [ ] 2.1 Create `$lib/auth/admin-guard.ts` with `requireAdmin(session)` helper
- [ ] 2.2 Write tests for admin guard (admin allowed, non-admin rejected, no
      session rejected)
- [ ] 2.3 Create admin layout at `src/routes/(admin)/admin/+layout.server.ts`
      with admin check

## 3. Admin Metrics API

- [ ] 3.1 Create `$lib/db/queries/admin-metrics.ts` with aggregate query
      functions:
  - `getSecretStatusCounts()` — count secrets grouped by status
  - `getUserCounts()` — total users, users with active secrets, pro users
  - `getEmailDeliveryStats()` — sent/failed/pending counts from disclosure_log
  - `getCronHealthStats()` — last run times, error counts from recent logs
  - `getFailedSecrets()` — list of failed secrets with owner info (no content)
  - `getRecentActivity()` — recent check-ins, secret creations, disclosures
- [ ] 3.2 Create API endpoint `src/routes/api/admin/metrics/+server.ts`
- [ ] 3.3 Write tests for admin metrics queries
- [ ] 3.4 Write tests for admin metrics API endpoint

## 4. Admin Dashboard Page

- [ ] 4.1 Create admin layout `src/routes/(admin)/admin/+layout.svelte` with
      admin nav
- [ ] 4.2 Create dashboard page `src/routes/(admin)/admin/+page.server.ts`
      loading all metrics
- [ ] 4.3 Create dashboard page `src/routes/(admin)/admin/+page.svelte` with:
  - Summary cards row (total secrets, active, failed, total users, pro users,
    emails sent today)
  - Failed secrets table (title, owner email, last error, failed at, retry
    count)
  - Email failures table (recipient, error, provider, created at) — from
    existing dead letter queue
  - Cron job status cards (last run, next run, status, recent error count)
- [ ] 4.4 Add admin link to NavBar for admin users (conditional rendering)

## 5. Testing & Verification

- [ ] 5.1 Write tests for admin page server load function
- [ ] 5.2 Run full build (`bun run build`)
- [ ] 5.3 Run full test suite (`bun test`)
- [ ] 5.4 Manual smoke test on staging
