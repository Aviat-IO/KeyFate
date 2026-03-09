# Add PostHog Analytics and Product Monitoring

## Why

Currently, we have limited visibility into production application performance,
user behavior, and error patterns. PostHog provides open-source product
analytics, session replay, feature flags, and error tracking in a
privacy-focused platform, giving us comprehensive insights without vendor
lock-in. PostHog offers similar monitoring to Sentry (error tracking,
performance) plus product analytics capabilities.

## What Changes

- Integrate PostHog SDK for client and server-side tracking
- Implement event tracking for key user actions (secret creation, check-ins,
  payments)
- Configure session replay for debugging production issues
- Set up performance monitoring (Core Web Vitals, API response times)
- Add feature flags capability for gradual rollouts
- Configure error tracking with privacy-safe data sanitization
- Implement user identification (optional, privacy-preserving)

## Impact

- **Affected specs:** New capability `analytics`
- **Affected code:**
  - `frontend/src/lib/analytics/` - PostHog SDK integration (new)
  - `frontend/src/app/layout.tsx` - PostHog provider initialization
  - `frontend/src/lib/logger.ts` - Integrate error tracking with PostHog
  - API routes - Server-side event tracking
  - Environment variables - `NEXT_PUBLIC_POSTHOG_KEY`,
    `NEXT_PUBLIC_POSTHOG_HOST`
- **Breaking changes:** None (additive only)
- **Privacy impact:** Session replay and analytics data - requires privacy
  policy update
- **Dependencies:** PostHog cloud (free tier) or self-hosted instance
- **Timeline:** 2-3 days for implementation and configuration
