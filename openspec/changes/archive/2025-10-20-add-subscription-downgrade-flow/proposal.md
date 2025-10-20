# Add Subscription Downgrade Flow

## Why

Pro users need an easy way to downgrade back to the free tier when they no longer need premium features. Currently, users can only upgrade to Pro but have no self-service path to downgrade, requiring them to contact support or manually cancel through external payment portals. This creates friction and poor user experience.

## What Changes

- Create new Settings section with sidebar navigation (`/settings`, `/settings/general`, `/settings/audit`, `/settings/subscription`)
- Add subscription management page (`/settings/subscription`) where users can view plan details and upgrade/downgrade
- Implement downgrade flow that schedules tier change at end of current billing period (not immediate)
- Add cron job (`/api/cron/process-subscription-downgrades`) to automatically process scheduled downgrades when subscription expires
- Support downgrade flow for both Stripe and BTCPay Server payment providers
- Move navigation menu items: "Settings" replaces individual links to subscription/audit pages
- Update navbar to include Settings dropdown item that links to `/settings`
- Display user general information (name, email, join date) on `/settings/general`

## Impact

- Affected specs: `settings-ui`, `subscription-management`
- Affected code:
  - New: `/settings/*` pages with sidebar navigation
  - New: `/api/cron/process-subscription-downgrades/route.ts`
  - Modified: `nav-bar.tsx` (add Settings menu item)
  - Modified: `subscription-service.ts` (add downgrade scheduling logic)
  - Modified: Database schema (`user_subscriptions` table needs `scheduled_downgrade_at` field)
  - Modified: Payment providers (Stripe, BTCPay) to handle downgrade cancellation
  - Modified: `audit-logs/page.tsx` location (move to `/settings/audit`)
