## 1. Project Scaffold

- [ ] 1.1 Create new SvelteKit 5 project with Bun (`bun create svelte@latest`)
- [ ] 1.2 Configure `svelte.config.js` (adapter-node or adapter-bun, aliases)
- [ ] 1.3 Configure `vite.config.ts` (Vitest integration, path aliases)
- [ ] 1.4 Configure `tsconfig.json` (strict mode, path aliases matching current
      setup)
- [ ] 1.5 Install and configure Tailwind CSS 4 for SvelteKit
- [ ] 1.6 Port `globals.css` theme variables and custom styles
- [ ] 1.7 Install and configure shadcn-svelte (`bunx shadcn-svelte@latest init`)
- [ ] 1.8 Add all required shadcn-svelte components (button, card, dialog, form,
      input, select, etc.)
- [ ] 1.9 Configure ESLint + Prettier for Svelte
- [ ] 1.10 Create Dockerfile using `oven/bun:1` base image
- [ ] 1.11 Update `docker-compose.yml` if needed
- [ ] 1.12 Verify project builds and starts with `bun run dev`

## 2. Backend Library Migration

- [ ] 2.1 Copy `src/lib/db/` (Drizzle schema, client, migrations) -
      framework-agnostic, minimal changes
- [ ] 2.2 Copy `drizzle.config.ts` and `drizzle/` migrations directory
- [ ] 2.3 Copy `src/lib/encryption.ts` - framework-agnostic
- [ ] 2.4 Copy `src/lib/email/` directory - framework-agnostic
- [ ] 2.5 Copy `src/lib/payment/` directory - framework-agnostic
- [ ] 2.6 Copy `src/lib/services/` directory - framework-agnostic
- [ ] 2.7 Copy `src/lib/gdpr/` directory - framework-agnostic
- [ ] 2.8 Copy `src/lib/cron/` directory - framework-agnostic
- [ ] 2.9 Copy `src/lib/webhooks/` directory - framework-agnostic
- [ ] 2.10 Copy `src/lib/api/` (validation, retry, pagination) -
      framework-agnostic
- [ ] 2.11 Copy `src/lib/errors/` directory - framework-agnostic
- [ ] 2.12 Copy `src/lib/schemas/` (Zod schemas) - framework-agnostic
- [ ] 2.13 Copy `src/lib/blog/` directory - framework-agnostic
- [ ] 2.14 Port `src/lib/server-env.ts` to SvelteKit `$env/static/private` and
      `$env/dynamic/private`
- [ ] 2.15 Port `src/lib/client-env.ts` to SvelteKit `$env/static/public` and
      `$env/dynamic/public`
- [ ] 2.16 Port `src/lib/utils.ts` (likely `cn()` utility) - add
      `clsx`/`tailwind-merge` if not already
- [ ] 2.17 Copy `src/lib/rate-limit.ts` and `src/lib/rate-limit-db.ts`
- [ ] 2.18 Copy `src/lib/circuit-breaker.ts`
- [ ] 2.19 Copy `src/lib/logger.ts`
- [ ] 2.20 Copy `src/lib/csrf.ts` - evaluate if SvelteKit's built-in CSRF is
      sufficient
- [ ] 2.21 Copy `src/lib/subscription.ts`, `subscription-utils.ts`, `pricing.ts`
- [ ] 2.22 Copy `src/lib/tier-validation.ts`
- [ ] 2.23 Copy `src/lib/time-utils.ts`
- [ ] 2.24 Copy `src/constants/` (tiers.ts, pro-features.ts,
      message-templates.ts)
- [ ] 2.25 Copy `src/types/` (types.ts, shamirs-secret-sharing.d.ts)
- [ ] 2.26 Verify all library modules compile with `bun run check`

## 3. Authentication (Auth.js for SvelteKit)

- [ ] 3.1 Install `@auth/sveltekit` and `@auth/drizzle-adapter` (if using DB
      sessions)
- [ ] 3.2 Create `src/auth.ts` - configure Auth.js with Google OAuth +
      Credentials providers
- [ ] 3.3 Port credential provider logic from `src/lib/auth-config.ts` (password
      verification, OTP, email check)
- [ ] 3.4 Create `src/hooks.server.ts` - Auth.js handle + custom middleware
      logic
- [ ] 3.5 Port middleware logic: HTTPS enforcement, request ID generation, email
      verification redirect, auth route redirects
- [ ] 3.6 Port `src/lib/auth/` directory (14 files: authorization, OTP,
      password, session management, etc.)
- [ ] 3.7 Create auth type augmentations for SvelteKit (`app.d.ts` - Locals,
      PageData)
- [ ] 3.8 Replace `getServerSession()` calls with `event.locals.session` pattern
      across all server code
- [ ] 3.9 Create `src/lib/auth/get-session.ts` helper for API routes that need
      session outside of hooks
- [ ] 3.10 Verify Google OAuth flow works end-to-end
- [ ] 3.11 Verify credentials (email + password) login works
- [ ] 3.12 Verify OTP login works
- [ ] 3.13 Verify email verification enforcement works
- [ ] 3.14 Verify privacy policy acceptance gate works

## 4. API Routes

### 4.1 Auth API (14 routes)

- [ ] 4.1.1 Port `/api/auth/[...nextauth]` -> Auth.js handles this automatically
      via hooks
- [ ] 4.1.2 Port `/api/auth/register` ->
      `src/routes/api/auth/register/+server.ts`
- [ ] 4.1.3 Port `/api/auth/request-otp` ->
      `src/routes/api/auth/request-otp/+server.ts`
- [ ] 4.1.4 Port `/api/auth/verify-otp` ->
      `src/routes/api/auth/verify-otp/+server.ts`
- [ ] 4.1.5 Port `/api/auth/verify-email` ->
      `src/routes/api/auth/verify-email/+server.ts`
- [ ] 4.1.6 Port `/api/auth/verify-email-nextauth` -> evaluate if still needed
      with Auth.js
- [ ] 4.1.7 Port `/api/auth/resend-verification` ->
      `src/routes/api/auth/resend-verification/+server.ts`
- [ ] 4.1.8 Port `/api/auth/verification-status` ->
      `src/routes/api/auth/verification-status/+server.ts`
- [ ] 4.1.9 Port `/api/auth/reset-password` ->
      `src/routes/api/auth/reset-password/+server.ts`
- [ ] 4.1.10 Port `/api/auth/request-password-reset` ->
      `src/routes/api/auth/request-password-reset/+server.ts`
- [ ] 4.1.11 Port `/api/auth/revoke-sessions` ->
      `src/routes/api/auth/revoke-sessions/+server.ts`
- [ ] 4.1.12 Port `/api/auth/providers` ->
      `src/routes/api/auth/providers/+server.ts`
- [ ] 4.1.13 Port `/api/auth/check-privacy-policy` ->
      `src/routes/api/auth/check-privacy-policy/+server.ts`
- [ ] 4.1.14 Port `/api/auth/accept-privacy-policy` ->
      `src/routes/api/auth/accept-privacy-policy/+server.ts`

### 4.2 Secrets API (8 routes)

- [ ] 4.2.1 Port `/api/secrets` (GET, POST) ->
      `src/routes/api/secrets/+server.ts`
- [ ] 4.2.2 Port `/api/secrets/[id]` (GET, PUT, DELETE) ->
      `src/routes/api/secrets/[id]/+server.ts`
- [ ] 4.2.3 Port `/api/secrets/[id]/check-in` ->
      `src/routes/api/secrets/[id]/check-in/+server.ts`
- [ ] 4.2.4 Port `/api/secrets/[id]/toggle-pause` ->
      `src/routes/api/secrets/[id]/toggle-pause/+server.ts`
- [ ] 4.2.5 Port `/api/secrets/[id]/reveal-server-share` ->
      `src/routes/api/secrets/[id]/reveal-server-share/+server.ts`
- [ ] 4.2.6 Port `/api/secrets/[id]/server-share` ->
      `src/routes/api/secrets/[id]/server-share/+server.ts`
- [ ] 4.2.7 Port `/api/secrets/[id]/delete-server-share` ->
      `src/routes/api/secrets/[id]/delete-server-share/+server.ts`
- [ ] 4.2.8 Port `/api/secrets/[id]/export-share` ->
      `src/routes/api/secrets/[id]/export-share/+server.ts`

### 4.3 User API (10 routes)

- [ ] 4.3.1 Port `/api/user/tier` -> `src/routes/api/user/tier/+server.ts`
- [ ] 4.3.2 Port `/api/user/subscription` ->
      `src/routes/api/user/subscription/+server.ts`
- [ ] 4.3.3 Port `/api/user/subscription/schedule-downgrade` ->
      `src/routes/api/user/subscription/schedule-downgrade/+server.ts`
- [ ] 4.3.4 Port `/api/user/subscription/cancel-downgrade` ->
      `src/routes/api/user/subscription/cancel-downgrade/+server.ts`
- [ ] 4.3.5 Port `/api/user/delete-account` ->
      `src/routes/api/user/delete-account/+server.ts`
- [ ] 4.3.6 Port `/api/user/delete-account/confirm` ->
      `src/routes/api/user/delete-account/confirm/+server.ts`
- [ ] 4.3.7 Port `/api/user/delete-account/cancel/[requestId]` ->
      `src/routes/api/user/delete-account/cancel/[requestId]/+server.ts`
- [ ] 4.3.8 Port `/api/user/deletion-status/[requestId]` ->
      `src/routes/api/user/deletion-status/[requestId]/+server.ts`
- [ ] 4.3.9 Port `/api/user/export-data` ->
      `src/routes/api/user/export-data/+server.ts`
- [ ] 4.3.10 Port `/api/user/export-data/[jobId]` ->
      `src/routes/api/user/export-data/[jobId]/+server.ts`

### 4.4 Cron API (7 routes)

- [ ] 4.4.1 Port `/api/cron/check-secrets` ->
      `src/routes/api/cron/check-secrets/+server.ts`
- [ ] 4.4.2 Port `/api/cron/process-reminders` ->
      `src/routes/api/cron/process-reminders/+server.ts`
- [ ] 4.4.3 Port `/api/cron/process-exports` ->
      `src/routes/api/cron/process-exports/+server.ts`
- [ ] 4.4.4 Port `/api/cron/process-deletions` ->
      `src/routes/api/cron/process-deletions/+server.ts`
- [ ] 4.4.5 Port `/api/cron/process-subscription-downgrades` ->
      `src/routes/api/cron/process-subscription-downgrades/+server.ts`
- [ ] 4.4.6 Port `/api/cron/cleanup-tokens` ->
      `src/routes/api/cron/cleanup-tokens/+server.ts`
- [ ] 4.4.7 Port `/api/cron/cleanup-exports` ->
      `src/routes/api/cron/cleanup-exports/+server.ts`

### 4.5 Webhooks (2 routes)

- [ ] 4.5.1 Port `/api/webhooks/stripe` ->
      `src/routes/api/webhooks/stripe/+server.ts`
- [ ] 4.5.2 Port `/api/webhooks/btcpay` ->
      `src/routes/api/webhooks/btcpay/+server.ts`

### 4.6 Payment API (3 routes)

- [ ] 4.6.1 Port `/api/create-checkout-session` ->
      `src/routes/api/create-checkout-session/+server.ts`
- [ ] 4.6.2 Port `/api/create-portal-session` ->
      `src/routes/api/create-portal-session/+server.ts`
- [ ] 4.6.3 Port `/api/create-btcpay-checkout` ->
      `src/routes/api/create-btcpay-checkout/+server.ts`

### 4.7 Health API (5 routes)

- [ ] 4.7.1 Port `/api/health` -> `src/routes/api/health/+server.ts`
- [ ] 4.7.2 Port `/api/health/pool` -> `src/routes/api/health/pool/+server.ts`
- [ ] 4.7.3 Port `/api/health/cron` -> `src/routes/api/health/cron/+server.ts`
- [ ] 4.7.4 Port `/api/health/database` ->
      `src/routes/api/health/database/+server.ts`
- [ ] 4.7.5 Port `/api/health/db` -> `src/routes/api/health/db/+server.ts`

### 4.8 Admin API (4 routes)

- [ ] 4.8.1 Port `/api/admin/email-failures` ->
      `src/routes/api/admin/email-failures/+server.ts`
- [ ] 4.8.2 Port `/api/admin/email-failures/batch-retry` ->
      `src/routes/api/admin/email-failures/batch-retry/+server.ts`
- [ ] 4.8.3 Port `/api/admin/email-failures/[id]` ->
      `src/routes/api/admin/email-failures/[id]/+server.ts`
- [ ] 4.8.4 Port `/api/admin/email-failures/[id]/retry` ->
      `src/routes/api/admin/email-failures/[id]/retry/+server.ts`

### 4.9 Other API (7 routes)

- [ ] 4.9.1 Port `/api/check-in` -> `src/routes/api/check-in/+server.ts`
- [ ] 4.9.2 Port `/api/audit-logs` -> `src/routes/api/audit-logs/+server.ts`
- [ ] 4.9.3 Port `/api/audit-logs/export` ->
      `src/routes/api/audit-logs/export/+server.ts`
- [ ] 4.9.4 Port `/api/csrf-token` -> `src/routes/api/csrf-token/+server.ts`
      (evaluate if SvelteKit CSRF makes this unnecessary)
- [ ] 4.9.5 Port `/api/encrypt` -> `src/routes/api/encrypt/+server.ts`
- [ ] 4.9.6 Port `/api/decrypt` -> `src/routes/api/decrypt/+server.ts`
- [ ] 4.9.7 Port `/api/config` -> `src/routes/api/config/+server.ts`

## 5. UI Components

### 5.1 shadcn-svelte Primitives

- [ ] 5.1.1 Add shadcn-svelte components: button, card, dialog, input, label,
      select, textarea, form, badge, alert, alert-dialog, accordion, checkbox,
      dropdown-menu, navigation-menu, progress, scroll-area, separator, table,
      toast, tooltip
- [ ] 5.1.2 Port `loading-indicator.tsx` -> `LoadingIndicator.svelte`
- [ ] 5.1.3 Port `spinner.tsx` -> `Spinner.svelte`
- [ ] 5.1.4 Port `social-buttons.tsx` -> `SocialButtons.svelte`
- [ ] 5.1.5 Port `letter-glitch.tsx` -> `LetterGlitch.svelte`

### 5.2 Auth Components

- [ ] 5.2.1 Port `auth-form.tsx` -> `AuthForm.svelte`
- [ ] 5.2.2 Port `otp-input.tsx` -> `OtpInput.svelte`
- [ ] 5.2.3 Port `turnstile.tsx` -> `Turnstile.svelte` (Cloudflare Turnstile)
- [ ] 5.2.4 Port `privacy-policy-guard.tsx` -> `PrivacyPolicyGuard.svelte`
- [ ] 5.2.5 Port email verification components (6 files) -> consolidate into
      `EmailVerification.svelte`
- [ ] 5.2.6 Port `resend-button.tsx` -> `ResendButton.svelte`
- [ ] 5.2.7 Port `verification-callback.tsx` -> `VerificationCallback.svelte`
- [ ] 5.2.8 Port `verification-status.tsx` -> `VerificationStatus.svelte`

### 5.3 Layout Components

- [ ] 5.3.1 Port `nav-bar.tsx` -> `NavBar.svelte`
- [ ] 5.3.2 Port `footer.tsx` -> `Footer.svelte`
- [ ] 5.3.3 Port `session-provider.tsx` -> SvelteKit handles this natively via
      `event.locals`
- [ ] 5.3.4 Port `theme-provider.tsx` and `theme-toggle.tsx` ->
      `ThemeToggle.svelte` using SvelteKit cookie-based theme

### 5.4 Secret Components

- [ ] 5.4.1 Port `secret-card.tsx` -> `SecretCard.svelte`
- [ ] 5.4.2 Port `secrets-grid.tsx` -> `SecretsGrid.svelte`
- [ ] 5.4.3 Port `check-in-button.tsx` -> `CheckInButton.svelte`
- [ ] 5.4.4 Port `toggle-pause-button.tsx` -> `TogglePauseButton.svelte`
- [ ] 5.4.5 Port `delete-confirm.tsx` -> `DeleteConfirm.svelte`
- [ ] 5.4.6 Port `ExportRecoveryKitButton.tsx` ->
      `ExportRecoveryKitButton.svelte`
- [ ] 5.4.7 Port `sss-decryptor.tsx` -> `SSSDecryptor.svelte`
- [ ] 5.4.8 Port `message-template-selector.tsx` ->
      `MessageTemplateSelector.svelte`

### 5.5 Form Components

- [ ] 5.5.1 Port `newSecretForm.tsx` -> `NewSecretForm.svelte` (replace
      react-hook-form with superforms or native)
- [ ] 5.5.2 Port `editSecretForm.tsx` -> `EditSecretForm.svelte`
- [ ] 5.5.3 Port `secretDetailsForm.tsx` -> `SecretDetailsForm.svelte`
- [ ] 5.5.4 Port `ThresholdSelector.tsx` -> `ThresholdSelector.svelte`
- [ ] 5.5.5 Port `contact-methods-form.tsx` -> `ContactMethodsForm.svelte`
- [ ] 5.5.6 Port `contact-methods-dialog.tsx` -> `ContactMethodsDialog.svelte`

### 5.6 Subscription Components

- [ ] 5.6.1 Port `PricingCard.tsx` -> `PricingCard.svelte`
- [ ] 5.6.2 Port `PricingPage.tsx` -> `PricingPage.svelte`
- [ ] 5.6.3 Port `StaticPricingPage.tsx` -> `StaticPricingPage.svelte`
- [ ] 5.6.4 Port `StripeCheckoutButton.tsx` -> `StripeCheckoutButton.svelte`
- [ ] 5.6.5 Port `BTCPayCheckoutButton.tsx` -> `BTCPayCheckoutButton.svelte`
- [ ] 5.6.6 Port `PaymentMethodSelector.tsx` -> `PaymentMethodSelector.svelte`
- [ ] 5.6.7 Port `BillingToggle.tsx` -> `BillingToggle.svelte`
- [ ] 5.6.8 Port `BillingPortalButton.tsx` -> `BillingPortalButton.svelte`
- [ ] 5.6.9 Port `SubscriptionManager.tsx` -> `SubscriptionManager.svelte`
- [ ] 5.6.10 Port `UsageIndicator.tsx` -> `UsageIndicator.svelte`
- [ ] 5.6.11 Port `UserPricingActions.tsx` -> `UserPricingActions.svelte`
- [ ] 5.6.12 Port `AlreadySubscribedDialog.tsx` ->
      `AlreadySubscribedDialog.svelte`
- [ ] 5.6.13 Port `UpgradeSuccessDialog.tsx` -> `UpgradeSuccessDialog.svelte`
- [ ] 5.6.14 Port `WelcomeToProModal.tsx` -> `WelcomeToProModal.svelte`

### 5.7 Other Components

- [ ] 5.7.1 Port `upgrade-modal.tsx` -> `UpgradeModal.svelte`
- [ ] 5.7.2 Port `tier-usage-card.tsx` -> `TierUsageCard.svelte`
- [ ] 5.7.3 Port `confetti.tsx` -> `Confetti.svelte`
- [ ] 5.7.4 Port `hero-glitch-background.tsx` -> `HeroGlitchBackground.svelte`
      (OGL WebGL)
- [ ] 5.7.5 Port `dev-tier-toggle.tsx` -> `DevTierToggle.svelte`
- [ ] 5.7.6 Port settings components (SettingsNav, SettingsPageHeader,
      SubscriptionManagement, privacy cards)
- [ ] 5.7.7 Port `AuditLogsPage.tsx` -> `AuditLogsPage.svelte`

## 6. Pages

### 6.1 Root Layout and Error Pages

- [ ] 6.1.1 Create `src/routes/+layout.svelte` (root layout with theme, fonts,
      metadata)
- [ ] 6.1.2 Create `src/routes/+layout.server.ts` (session loading)
- [ ] 6.1.3 Create `src/routes/+error.svelte` (error boundary)
- [ ] 6.1.4 Port `not-found.tsx` -> `src/routes/+error.svelte` (404 handling)

### 6.2 Public Pages

- [ ] 6.2.1 Port home page `/` -> `src/routes/+page.svelte`
- [ ] 6.2.2 Port `/faq` -> `src/routes/faq/+page.svelte`
- [ ] 6.2.3 Port `/sign-in` -> `src/routes/sign-in/+page.svelte`
- [ ] 6.2.4 Port `/sign-up` -> `src/routes/sign-up/+page.svelte`
- [ ] 6.2.5 Port `/check-in` -> `src/routes/check-in/+page.svelte` +
      `+page.server.ts`
- [ ] 6.2.6 Port `/decrypt` -> `src/routes/decrypt/+page.svelte`
- [ ] 6.2.7 Port `/terms-of-service` ->
      `src/routes/terms-of-service/+page.svelte` + `+page.server.ts`
- [ ] 6.2.8 Port `/privacy-policy` -> `src/routes/privacy-policy/+page.svelte` +
      `+page.server.ts`
- [ ] 6.2.9 Port `/confirm-deletion` ->
      `src/routes/confirm-deletion/+page.svelte`
- [ ] 6.2.10 Port `/local-instructions` ->
      `src/routes/local-instructions/+page.svelte`

### 6.3 Auth Pages

- [ ] 6.3.1 Create `src/routes/auth/+layout.svelte` (auth layout)
- [ ] 6.3.2 Port `/auth/signin` -> `src/routes/auth/signin/+page.svelte`
- [ ] 6.3.3 Port `/auth/login` -> `src/routes/auth/login/+page.svelte`
- [ ] 6.3.4 Port `/auth/error` -> `src/routes/auth/error/+page.svelte`
- [ ] 6.3.5 Port `/auth/verify-callback` ->
      `src/routes/auth/verify-callback/+page.svelte`
- [ ] 6.3.6 Port `/auth/reset-password` ->
      `src/routes/auth/reset-password/+page.svelte`
- [ ] 6.3.7 Port `/auth/forgot-password` ->
      `src/routes/auth/forgot-password/+page.svelte`
- [ ] 6.3.8 Port `/auth/update-password` ->
      `src/routes/auth/update-password/+page.svelte`
- [ ] 6.3.9 Port `/auth/verify-email` ->
      `src/routes/auth/verify-email/+page.svelte`
- [ ] 6.3.10 Port `/auth/verify` -> `src/routes/auth/verify/+page.svelte`

### 6.4 Authenticated Pages

- [ ] 6.4.1 Create `src/routes/(authenticated)/+layout.svelte` +
      `+layout.server.ts` (auth guard)
- [ ] 6.4.2 Port `/dashboard` ->
      `src/routes/(authenticated)/dashboard/+page.svelte` + `+page.server.ts`
- [ ] 6.4.3 Port `/secrets/new` ->
      `src/routes/(authenticated)/secrets/new/+page.svelte`
- [ ] 6.4.4 Port `/secrets/[id]/view` ->
      `src/routes/(authenticated)/secrets/[id]/view/+page.svelte` +
      `+page.server.ts`
- [ ] 6.4.5 Port `/secrets/[id]/edit` ->
      `src/routes/(authenticated)/secrets/[id]/edit/+page.svelte` +
      `+page.server.ts`
- [ ] 6.4.6 Port `/secrets/[id]/share-instructions` ->
      `src/routes/(authenticated)/secrets/[id]/share-instructions/+page.svelte`
- [ ] 6.4.7 Port `/settings` ->
      `src/routes/(authenticated)/settings/+page.svelte`
- [ ] 6.4.8 Create `src/routes/(authenticated)/settings/+layout.svelte`
      (settings sub-layout)
- [ ] 6.4.9 Port `/settings/general` ->
      `src/routes/(authenticated)/settings/general/+page.svelte`
- [ ] 6.4.10 Port `/settings/subscription` ->
      `src/routes/(authenticated)/settings/subscription/+page.svelte` +
      `+page.server.ts`
- [ ] 6.4.11 Port `/settings/privacy` ->
      `src/routes/(authenticated)/settings/privacy/+page.svelte` +
      `+page.server.ts`
- [ ] 6.4.12 Port `/settings/audit` ->
      `src/routes/(authenticated)/settings/audit/+page.svelte` +
      `+page.server.ts`
- [ ] 6.4.13 Port `/audit-logs` ->
      `src/routes/(authenticated)/audit-logs/+page.svelte` + `+page.server.ts`

### 6.5 Main (Public with Layout) Pages

- [ ] 6.5.1 Port `/pricing` -> `src/routes/(main)/pricing/+page.svelte` +
      `+page.server.ts`
- [ ] 6.5.2 Port `/refunds` -> `src/routes/(main)/refunds/+page.svelte`

### 6.6 Blog

- [ ] 6.6.1 Create `src/routes/blog/+layout.svelte`
- [ ] 6.6.2 Port `/blog` -> `src/routes/blog/+page.svelte` + `+page.server.ts`
- [ ] 6.6.3 Port `/blog/[slug]` -> `src/routes/blog/[slug]/+page.svelte` +
      `+page.server.ts`

### 6.7 Landing Pages

- [ ] 6.7.1 Port `/lp/estate` -> `src/routes/lp/estate/+page.svelte`
- [ ] 6.7.2 Port `/lp/crypto` -> `src/routes/lp/crypto/+page.svelte`

### 6.8 Profile and Misc

- [ ] 6.8.1 Port `/profile` -> `src/routes/profile/+page.svelte` +
      `+page.server.ts`
- [ ] 6.8.2 Remove test-only pages (`/test-env`, `/test-checkout`) or port if
      needed for dev

## 7. Hooks (React -> Svelte Runes)

- [ ] 7.1 Port `useCSRF` hook -> evaluate if needed (SvelteKit has built-in
      CSRF)
- [ ] 7.2 Port `useContactMethods` hook -> Svelte store or rune-based equivalent
- [ ] 7.3 Port `use-toast` hook -> use shadcn-svelte toast (built-in)

## 8. Testing

- [ ] 8.1 Configure Vitest for SvelteKit (`vitest.config.ts` with
      `@testing-library/svelte`)
- [ ] 8.2 Port test setup files (`__tests__/setup.ts`, `__tests__/api/setup.ts`)
- [ ] 8.3 Port test utilities (`test-helpers.ts`, `test-factories.ts`,
      `test-db.ts`)
- [ ] 8.4 Port backend library tests (minimal changes - `lib/db/`, `lib/email/`,
      `lib/payment/`, `lib/services/`, `lib/gdpr/`, `lib/cron/`)
- [ ] 8.5 Port API route tests (change import paths, use SvelteKit request
      helpers)
- [ ] 8.6 Port component tests (rewrite with `@testing-library/svelte`)
- [ ] 8.7 Port security tests (CSRF, webhook replay, cron HMAC, re-auth)
- [ ] 8.8 Port page-level tests
- [ ] 8.9 Verify all tests pass with `bun run test`

## 9. Infrastructure and Build

- [ ] 9.1 Create `Dockerfile` for Bun + SvelteKit (multi-stage build)
- [ ] 9.2 Create `migrate-and-start.sh` script for Bun runtime
- [ ] 9.3 Update `Makefile` commands for Bun (replace pnpm references)
- [ ] 9.4 Update `.github/workflows/` CI for Bun
- [ ] 9.5 Update `docker-compose.yml` if frontend service definition changes
- [ ] 9.6 Verify `bun run build` produces working production build
- [ ] 9.7 Verify `bun run preview` serves production build correctly
- [ ] 9.8 Verify Docker build works end-to-end
- [ ] 9.9 Remove Next.js-specific files (`next.config.ts`, `next-env.d.ts`,
      `.next/`)

## 10. Cleanup

- [ ] 10.1 Remove all React/Next.js dependencies from `package.json`
- [ ] 10.2 Remove `next-auth` types from `types/next-auth.d.ts`
- [ ] 10.3 Update `openspec/project.md` to reflect new tech stack
- [ ] 10.4 Verify full build + test suite passes
- [ ] 10.5 Manual smoke test of all major flows (auth, secret CRUD, check-in,
      payment, settings)
