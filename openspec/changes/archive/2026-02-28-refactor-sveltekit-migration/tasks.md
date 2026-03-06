## 1. Project Scaffold

- [x] 1.1 Create new SvelteKit 5 project with Bun (`bun create svelte@latest`)
- [x] 1.2 Configure `svelte.config.js` (adapter-node or adapter-bun, aliases)
- [x] 1.3 Configure `vite.config.ts` (Vitest integration, path aliases)
- [x] 1.4 Configure `tsconfig.json` (strict mode, path aliases matching current
      setup)
- [x] 1.5 Install and configure Tailwind CSS 4 for SvelteKit
- [x] 1.6 Port `globals.css` theme variables and custom styles
- [x] 1.7 Install and configure shadcn-svelte (`bunx shadcn-svelte@latest init`)
- [x] 1.8 Add all required shadcn-svelte components (button, card, dialog, form,
      input, select, etc.)
- [x] 1.9 Configure ESLint + Prettier for Svelte
- [x] 1.10 Create Dockerfile using `oven/bun:1` base image
- [x] 1.11 Update `docker-compose.yml` if needed
- [x] 1.12 Verify project builds and starts with `bun run dev`

## 2. Backend Library Migration

- [x] 2.1 Copy `src/lib/db/` (Drizzle schema, client, migrations) -
      framework-agnostic, minimal changes
- [x] 2.2 Copy `drizzle.config.ts` and `drizzle/` migrations directory
- [x] 2.3 Copy `src/lib/encryption.ts` - framework-agnostic
- [x] 2.4 Copy `src/lib/email/` directory - framework-agnostic
- [x] 2.5 Copy `src/lib/payment/` directory - framework-agnostic
- [x] 2.6 Copy `src/lib/services/` directory - framework-agnostic
- [x] 2.7 Copy `src/lib/gdpr/` directory - framework-agnostic
- [x] 2.8 Copy `src/lib/cron/` directory - framework-agnostic
- [x] 2.9 Copy `src/lib/webhooks/` directory - framework-agnostic
- [x] 2.10 Copy `src/lib/api/` (validation, retry, pagination) -
      framework-agnostic
- [x] 2.11 Copy `src/lib/errors/` directory - framework-agnostic
- [x] 2.12 Copy `src/lib/schemas/` (Zod schemas) - framework-agnostic
- [x] 2.13 Copy `src/lib/blog/` directory - framework-agnostic
- [x] 2.14 Port `src/lib/server-env.ts` to SvelteKit `$env/static/private` and
      `$env/dynamic/private`
- [x] 2.15 Port `src/lib/client-env.ts` to SvelteKit `$env/static/public` and
      `$env/dynamic/public`
- [x] 2.16 Port `src/lib/utils.ts` (likely `cn()` utility) - add
      `clsx`/`tailwind-merge` if not already
- [x] 2.17 Copy `src/lib/rate-limit.ts` and `src/lib/rate-limit-db.ts`
- [x] 2.18 Copy `src/lib/circuit-breaker.ts`
- [x] 2.19 Copy `src/lib/logger.ts`
- [x] 2.20 Copy `src/lib/csrf.ts` - evaluate if SvelteKit's built-in CSRF is
      sufficient
- [x] 2.21 Copy `src/lib/subscription.ts`, `subscription-utils.ts`, `pricing.ts`
- [x] 2.22 Copy `src/lib/tier-validation.ts`
- [x] 2.23 Copy `src/lib/time-utils.ts`
- [x] 2.24 Copy `src/constants/` (tiers.ts, pro-features.ts,
      message-templates.ts)
- [x] 2.25 Copy `src/types/` (types.ts, shamirs-secret-sharing.d.ts)
- [x] 2.26 Verify all library modules compile with `bun run check`

## 3. Authentication (Auth.js for SvelteKit)

- [x] 3.1 Install `@auth/sveltekit` and `@auth/drizzle-adapter` (if using DB
      sessions)
- [x] 3.2 Create `src/auth.ts` - configure Auth.js with Google OAuth +
      Credentials providers
- [x] 3.3 Port credential provider logic from `src/lib/auth-config.ts` (password
      verification, OTP, email check)
- [x] 3.4 Create `src/hooks.server.ts` - Auth.js handle + custom middleware
      logic
- [x] 3.5 Port middleware logic: HTTPS enforcement, request ID generation, email
      verification redirect, auth route redirects
- [x] 3.6 Port `src/lib/auth/` directory (14 files: authorization, OTP,
      password, session management, etc.)
- [x] 3.7 Create auth type augmentations for SvelteKit (`app.d.ts` - Locals,
      PageData)
- [x] 3.8 Replace `getServerSession()` calls with `event.locals.session` pattern
      across all server code
- [x] 3.9 Create `src/lib/auth/get-session.ts` helper for API routes that need
      session outside of hooks
- [ ] 3.10 Verify Google OAuth flow works end-to-end
- [ ] 3.11 Verify credentials (email + password) login works
- [ ] 3.12 Verify OTP login works
- [ ] 3.13 Verify email verification enforcement works
- [ ] 3.14 Verify privacy policy acceptance gate works

## 4. API Routes

### 4.1 Auth API (14 routes)

- [x] 4.1.1 Port `/api/auth/[...nextauth]` -> Auth.js handles this automatically
      via hooks
- [x] 4.1.2 Port `/api/auth/register` ->
      `src/routes/api/auth/register/+server.ts`
- [x] 4.1.3 Port `/api/auth/request-otp` ->
      `src/routes/api/auth/request-otp/+server.ts`
- [x] 4.1.4 Port `/api/auth/verify-otp` ->
      `src/routes/api/auth/verify-otp/+server.ts`
- [x] 4.1.5 Port `/api/auth/verify-email` ->
      `src/routes/api/auth/verify-email/+server.ts`
- [x] 4.1.6 Port `/api/auth/verify-email-nextauth` -> evaluate if still needed
      with Auth.js
- [x] 4.1.7 Port `/api/auth/resend-verification` ->
      `src/routes/api/auth/resend-verification/+server.ts`
- [x] 4.1.8 Port `/api/auth/verification-status` ->
      `src/routes/api/auth/verification-status/+server.ts`
- [x] 4.1.9 Port `/api/auth/reset-password` ->
      `src/routes/api/auth/reset-password/+server.ts`
- [x] 4.1.10 Port `/api/auth/request-password-reset` ->
      `src/routes/api/auth/request-password-reset/+server.ts`
- [x] 4.1.11 Port `/api/auth/revoke-sessions` ->
      `src/routes/api/auth/revoke-sessions/+server.ts`
- [x] 4.1.12 Port `/api/auth/providers` ->
      `src/routes/api/auth/providers/+server.ts`
- [x] 4.1.13 Port `/api/auth/check-privacy-policy` ->
      `src/routes/api/auth/check-privacy-policy/+server.ts`
- [x] 4.1.14 Port `/api/auth/accept-privacy-policy` ->
      `src/routes/api/auth/accept-privacy-policy/+server.ts`

### 4.2 Secrets API (8 routes)

- [x] 4.2.1 Port `/api/secrets` (GET, POST) ->
      `src/routes/api/secrets/+server.ts`
- [x] 4.2.2 Port `/api/secrets/[id]` (GET, PUT, DELETE) ->
      `src/routes/api/secrets/[id]/+server.ts`
- [x] 4.2.3 Port `/api/secrets/[id]/check-in` ->
      `src/routes/api/secrets/[id]/check-in/+server.ts`
- [x] 4.2.4 Port `/api/secrets/[id]/toggle-pause` ->
      `src/routes/api/secrets/[id]/toggle-pause/+server.ts`
- [x] 4.2.5 Port `/api/secrets/[id]/reveal-server-share` ->
      `src/routes/api/secrets/[id]/reveal-server-share/+server.ts`
- [x] 4.2.6 Port `/api/secrets/[id]/server-share` ->
      `src/routes/api/secrets/[id]/server-share/+server.ts`
- [x] 4.2.7 Port `/api/secrets/[id]/delete-server-share` ->
      `src/routes/api/secrets/[id]/delete-server-share/+server.ts`
- [x] 4.2.8 Port `/api/secrets/[id]/export-share` ->
      `src/routes/api/secrets/[id]/export-share/+server.ts`

### 4.3 User API (10 routes)

- [x] 4.3.1 Port `/api/user/tier` -> `src/routes/api/user/tier/+server.ts`
- [x] 4.3.2 Port `/api/user/subscription` ->
      `src/routes/api/user/subscription/+server.ts`
- [x] 4.3.3 Port `/api/user/subscription/schedule-downgrade` ->
      `src/routes/api/user/subscription/schedule-downgrade/+server.ts`
- [x] 4.3.4 Port `/api/user/subscription/cancel-downgrade` ->
      `src/routes/api/user/subscription/cancel-downgrade/+server.ts`
- [x] 4.3.5 Port `/api/user/delete-account` ->
      `src/routes/api/user/delete-account/+server.ts`
- [x] 4.3.6 Port `/api/user/delete-account/confirm` ->
      `src/routes/api/user/delete-account/confirm/+server.ts`
- [x] 4.3.7 Port `/api/user/delete-account/cancel/[requestId]` ->
      `src/routes/api/user/delete-account/cancel/[requestId]/+server.ts`
- [x] 4.3.8 Port `/api/user/deletion-status/[requestId]` ->
      `src/routes/api/user/deletion-status/[requestId]/+server.ts`
- [x] 4.3.9 Port `/api/user/export-data` ->
      `src/routes/api/user/export-data/+server.ts`
- [x] 4.3.10 Port `/api/user/export-data/[jobId]` ->
      `src/routes/api/user/export-data/[jobId]/+server.ts`

### 4.4 Cron API (7 routes)

- [x] 4.4.1 Port `/api/cron/check-secrets` ->
      `src/routes/api/cron/check-secrets/+server.ts`
- [x] 4.4.2 Port `/api/cron/process-reminders` ->
      `src/routes/api/cron/process-reminders/+server.ts`
- [x] 4.4.3 Port `/api/cron/process-exports` ->
      `src/routes/api/cron/process-exports/+server.ts`
- [x] 4.4.4 Port `/api/cron/process-deletions` ->
      `src/routes/api/cron/process-deletions/+server.ts`
- [x] 4.4.5 Port `/api/cron/process-subscription-downgrades` ->
      `src/routes/api/cron/process-subscription-downgrades/+server.ts`
- [x] 4.4.6 Port `/api/cron/cleanup-tokens` ->
      `src/routes/api/cron/cleanup-tokens/+server.ts`
- [x] 4.4.7 Port `/api/cron/cleanup-exports` ->
      `src/routes/api/cron/cleanup-exports/+server.ts`

### 4.5 Webhooks (2 routes)

- [x] 4.5.1 Port `/api/webhooks/stripe` ->
      `src/routes/api/webhooks/stripe/+server.ts`
- [x] 4.5.2 Port `/api/webhooks/btcpay` ->
      `src/routes/api/webhooks/btcpay/+server.ts`

### 4.6 Payment API (3 routes)

- [x] 4.6.1 Port `/api/create-checkout-session` ->
      `src/routes/api/create-checkout-session/+server.ts`
- [x] 4.6.2 Port `/api/create-portal-session` ->
      `src/routes/api/create-portal-session/+server.ts`
- [x] 4.6.3 Port `/api/create-btcpay-checkout` ->
      `src/routes/api/create-btcpay-checkout/+server.ts`

### 4.7 Health API (5 routes)

- [x] 4.7.1 Port `/api/health` -> `src/routes/api/health/+server.ts`
- [x] 4.7.2 Port `/api/health/pool` -> `src/routes/api/health/pool/+server.ts`
- [x] 4.7.3 Port `/api/health/cron` -> `src/routes/api/health/cron/+server.ts`
- [x] 4.7.4 Port `/api/health/database` ->
      `src/routes/api/health/database/+server.ts`
- [x] 4.7.5 Port `/api/health/db` -> `src/routes/api/health/db/+server.ts`

### 4.8 Admin API (4 routes)

- [x] 4.8.1 Port `/api/admin/email-failures` ->
      `src/routes/api/admin/email-failures/+server.ts`
- [x] 4.8.2 Port `/api/admin/email-failures/batch-retry` ->
      `src/routes/api/admin/email-failures/batch-retry/+server.ts`
- [x] 4.8.3 Port `/api/admin/email-failures/[id]` ->
      `src/routes/api/admin/email-failures/[id]/+server.ts`
- [x] 4.8.4 Port `/api/admin/email-failures/[id]/retry` ->
      `src/routes/api/admin/email-failures/[id]/retry/+server.ts`

### 4.9 Other API (7 routes)

- [x] 4.9.1 Port `/api/check-in` -> `src/routes/api/check-in/+server.ts`
- [x] 4.9.2 Port `/api/audit-logs` -> `src/routes/api/audit-logs/+server.ts`
- [x] 4.9.3 Port `/api/audit-logs/export` ->
      `src/routes/api/audit-logs/export/+server.ts`
- [x] 4.9.4 Port `/api/csrf-token` -> `src/routes/api/csrf-token/+server.ts`
      (evaluate if SvelteKit CSRF makes this unnecessary)
- [x] 4.9.5 Port `/api/encrypt` -> `src/routes/api/encrypt/+server.ts`
- [x] 4.9.6 Port `/api/decrypt` -> `src/routes/api/decrypt/+server.ts`
- [x] 4.9.7 Port `/api/config` -> `src/routes/api/config/+server.ts`

## 5. UI Components

### 5.1 shadcn-svelte Primitives

- [x] 5.1.1 Add shadcn-svelte components: button, card, dialog, input, label,
      select, textarea, form, badge, alert, alert-dialog, accordion, checkbox,
      dropdown-menu, navigation-menu, progress, scroll-area, separator, table,
      toast, tooltip
- [x] 5.1.2 Port `loading-indicator.tsx` -> `LoadingIndicator.svelte`
- [x] 5.1.3 Port `spinner.tsx` -> `Spinner.svelte`
- [x] 5.1.4 Port `social-buttons.tsx` -> `SocialButtons.svelte`
- [x] 5.1.5 Port `letter-glitch.tsx` -> `LetterGlitch.svelte`

### 5.2 Auth Components

- [x] 5.2.1 Port `auth-form.tsx` -> `AuthForm.svelte`
- [x] 5.2.2 Port `otp-input.tsx` -> `OtpInput.svelte`
- [x] 5.2.3 Port `turnstile.tsx` -> `Turnstile.svelte` (Cloudflare Turnstile)
- [x] 5.2.4 Port `privacy-policy-guard.tsx` -> `PrivacyPolicyGuard.svelte`
- [x] 5.2.5 Port email verification components (6 files) -> consolidate into
      `EmailVerification.svelte`
- [x] 5.2.6 Port `resend-button.tsx` -> `ResendButton.svelte`
- [x] 5.2.7 Port `verification-callback.tsx` -> `VerificationCallback.svelte`
- [x] 5.2.8 Port `verification-status.tsx` -> `VerificationStatus.svelte`

### 5.3 Layout Components

- [x] 5.3.1 Port `nav-bar.tsx` -> `NavBar.svelte`
- [x] 5.3.2 Port `footer.tsx` -> `Footer.svelte`
- [x] 5.3.3 Port `session-provider.tsx` -> SvelteKit handles this natively via
      `event.locals`
- [x] 5.3.4 Port `theme-provider.tsx` and `theme-toggle.tsx` ->
      `ThemeToggle.svelte` using SvelteKit cookie-based theme

### 5.4 Secret Components

- [x] 5.4.1 Port `secret-card.tsx` -> `SecretCard.svelte`
- [x] 5.4.2 Port `secrets-grid.tsx` -> `SecretsGrid.svelte`
- [x] 5.4.3 Port `check-in-button.tsx` -> `CheckInButton.svelte`
- [x] 5.4.4 Port `toggle-pause-button.tsx` -> `TogglePauseButton.svelte`
- [x] 5.4.5 Port `delete-confirm.tsx` -> `DeleteConfirm.svelte`
- [x] 5.4.6 Port `ExportRecoveryKitButton.tsx` ->
      `ExportRecoveryKitButton.svelte`
- [x] 5.4.7 Port `sss-decryptor.tsx` -> `SSSDecryptor.svelte`
- [x] 5.4.8 Port `message-template-selector.tsx` ->
      `MessageTemplateSelector.svelte`

### 5.5 Form Components

- [x] 5.5.1 Port `newSecretForm.tsx` -> `NewSecretForm.svelte` (replace
      react-hook-form with superforms or native)
- [x] 5.5.2 Port `editSecretForm.tsx` -> `EditSecretForm.svelte`
- [x] 5.5.3 Port `secretDetailsForm.tsx` -> `SecretDetailsForm.svelte`
- [x] 5.5.4 Port `ThresholdSelector.tsx` -> `ThresholdSelector.svelte`
- [x] 5.5.5 Port `contact-methods-form.tsx` -> `ContactMethodsForm.svelte`
- [x] 5.5.6 Port `contact-methods-dialog.tsx` -> `ContactMethodsDialog.svelte`

### 5.6 Subscription Components

- [x] 5.6.1 Port `PricingCard.tsx` -> `PricingCard.svelte`
- [x] 5.6.2 Port `PricingPage.tsx` -> `PricingPage.svelte`
- [x] 5.6.3 Port `StaticPricingPage.tsx` -> `StaticPricingPage.svelte`
- [x] 5.6.4 Port `StripeCheckoutButton.tsx` -> `StripeCheckoutButton.svelte`
- [x] 5.6.5 Port `BTCPayCheckoutButton.tsx` -> `BTCPayCheckoutButton.svelte`
- [x] 5.6.6 Port `PaymentMethodSelector.tsx` -> `PaymentMethodSelector.svelte`
- [x] 5.6.7 Port `BillingToggle.tsx` -> `BillingToggle.svelte`
- [x] 5.6.8 Port `BillingPortalButton.tsx` -> `BillingPortalButton.svelte`
- [x] 5.6.9 Port `SubscriptionManager.tsx` -> `SubscriptionManager.svelte`
- [x] 5.6.10 Port `UsageIndicator.tsx` -> `UsageIndicator.svelte`
- [x] 5.6.11 Port `UserPricingActions.tsx` -> `UserPricingActions.svelte`
- [x] 5.6.12 Port `AlreadySubscribedDialog.tsx` ->
      `AlreadySubscribedDialog.svelte`
- [x] 5.6.13 Port `UpgradeSuccessDialog.tsx` -> `UpgradeSuccessDialog.svelte`
- [x] 5.6.14 Port `WelcomeToProModal.tsx` -> `WelcomeToProModal.svelte`

### 5.7 Other Components

- [x] 5.7.1 Port `upgrade-modal.tsx` -> `UpgradeModal.svelte`
- [x] 5.7.2 Port `tier-usage-card.tsx` -> `TierUsageCard.svelte`
- [x] 5.7.3 Port `confetti.tsx` -> `Confetti.svelte`
- [x] 5.7.4 Port `hero-glitch-background.tsx` -> `HeroGlitchBackground.svelte`
      (OGL WebGL)
- [x] 5.7.5 Port `dev-tier-toggle.tsx` -> `DevTierToggle.svelte`
- [x] 5.7.6 Port settings components (SettingsNav, SettingsPageHeader,
      SubscriptionManagement, privacy cards)
- [x] 5.7.7 Port `AuditLogsPage.tsx` -> `AuditLogsPage.svelte`

## 6. Pages

### 6.1 Root Layout and Error Pages

- [x] 6.1.1 Create `src/routes/+layout.svelte` (root layout with theme, fonts,
      metadata)
- [x] 6.1.2 Create `src/routes/+layout.server.ts` (session loading)
- [x] 6.1.3 Create `src/routes/+error.svelte` (error boundary)
- [x] 6.1.4 Port `not-found.tsx` -> `src/routes/+error.svelte` (404 handling)

### 6.2 Public Pages

- [x] 6.2.1 Port home page `/` -> `src/routes/+page.svelte`
- [x] 6.2.2 Port `/faq` -> `src/routes/faq/+page.svelte`
- [x] 6.2.3 Port `/sign-in` -> `src/routes/sign-in/+page.svelte`
- [x] 6.2.4 Port `/sign-up` -> `src/routes/sign-up/+page.svelte`
- [x] 6.2.5 Port `/check-in` -> `src/routes/check-in/+page.svelte` +
      `+page.server.ts`
- [x] 6.2.6 Port `/decrypt` -> `src/routes/decrypt/+page.svelte`
- [x] 6.2.7 Port `/terms-of-service` ->
      `src/routes/terms-of-service/+page.svelte` + `+page.server.ts`
- [x] 6.2.8 Port `/privacy-policy` -> `src/routes/privacy-policy/+page.svelte` +
      `+page.server.ts`
- [x] 6.2.9 Port `/confirm-deletion` ->
      `src/routes/confirm-deletion/+page.svelte`
- [x] 6.2.10 Port `/local-instructions` ->
      `src/routes/local-instructions/+page.svelte`

### 6.3 Auth Pages

- [x] 6.3.1 Create `src/routes/auth/+layout.svelte` (auth layout)
- [x] 6.3.2 Port `/auth/signin` -> `src/routes/auth/signin/+page.svelte`
- [x] 6.3.3 Port `/auth/login` -> `src/routes/auth/login/+page.svelte`
- [x] 6.3.4 Port `/auth/error` -> `src/routes/auth/error/+page.svelte`
- [x] 6.3.5 Port `/auth/verify-callback` ->
      `src/routes/auth/verify-callback/+page.svelte`
- [x] 6.3.6 Port `/auth/reset-password` ->
      `src/routes/auth/reset-password/+page.svelte`
- [x] 6.3.7 Port `/auth/forgot-password` ->
      `src/routes/auth/forgot-password/+page.svelte`
- [x] 6.3.8 Port `/auth/update-password` ->
      `src/routes/auth/update-password/+page.svelte`
- [x] 6.3.9 Port `/auth/verify-email` ->
      `src/routes/auth/verify-email/+page.svelte`
- [x] 6.3.10 Port `/auth/verify` -> `src/routes/auth/verify/+page.svelte`

### 6.4 Authenticated Pages

- [x] 6.4.1 Create `src/routes/(authenticated)/+layout.svelte` +
      `+layout.server.ts` (auth guard)
- [x] 6.4.2 Port `/dashboard` ->
      `src/routes/(authenticated)/dashboard/+page.svelte` + `+page.server.ts`
- [x] 6.4.3 Port `/secrets/new` ->
      `src/routes/(authenticated)/secrets/new/+page.svelte`
- [x] 6.4.4 Port `/secrets/[id]/view` ->
      `src/routes/(authenticated)/secrets/[id]/view/+page.svelte` +
      `+page.server.ts`
- [x] 6.4.5 Port `/secrets/[id]/edit` ->
      `src/routes/(authenticated)/secrets/[id]/edit/+page.svelte` +
      `+page.server.ts`
- [x] 6.4.6 Port `/secrets/[id]/share-instructions` ->
      `src/routes/(authenticated)/secrets/[id]/share-instructions/+page.svelte`
- [x] 6.4.7 Port `/settings` ->
      `src/routes/(authenticated)/settings/+page.svelte`
- [x] 6.4.8 Create `src/routes/(authenticated)/settings/+layout.svelte`
      (settings sub-layout)
- [x] 6.4.9 Port `/settings/general` ->
      `src/routes/(authenticated)/settings/general/+page.svelte`
- [x] 6.4.10 Port `/settings/subscription` ->
      `src/routes/(authenticated)/settings/subscription/+page.svelte` +
      `+page.server.ts`
- [x] 6.4.11 Port `/settings/privacy` ->
      `src/routes/(authenticated)/settings/privacy/+page.svelte` +
      `+page.server.ts`
- [x] 6.4.12 Port `/settings/audit` ->
      `src/routes/(authenticated)/settings/audit/+page.svelte` +
      `+page.server.ts`
- [x] 6.4.13 Port `/audit-logs` ->
      `src/routes/(authenticated)/audit-logs/+page.svelte` + `+page.server.ts`

### 6.5 Main (Public with Layout) Pages

- [x] 6.5.1 Port `/pricing` -> `src/routes/(main)/pricing/+page.svelte` +
      `+page.server.ts`
- [x] 6.5.2 Port `/refunds` -> `src/routes/(main)/refunds/+page.svelte`

### 6.6 Blog

- [x] 6.6.1 Create `src/routes/blog/+layout.svelte`
- [x] 6.6.2 Port `/blog` -> `src/routes/blog/+page.svelte` + `+page.server.ts`
- [x] 6.6.3 Port `/blog/[slug]` -> `src/routes/blog/[slug]/+page.svelte` +
      `+page.server.ts`

### 6.7 Landing Pages

- [x] 6.7.1 Port `/lp/estate` -> `src/routes/lp/estate/+page.svelte`
- [x] 6.7.2 Port `/lp/crypto` -> `src/routes/lp/crypto/+page.svelte`

### 6.8 Profile and Misc

- [x] 6.8.1 Port `/profile` -> `src/routes/profile/+page.svelte` +
      `+page.server.ts`
- [x] 6.8.2 Remove test-only pages (`/test-env`, `/test-checkout`) or port if
      needed for dev

## 7. Hooks (React -> Svelte Runes)

- [x] 7.1 Port `useCSRF` hook -> evaluate if needed (SvelteKit has built-in
      CSRF)
- [x] 7.2 Port `useContactMethods` hook -> Svelte store or rune-based equivalent
- [x] 7.3 Port `use-toast` hook -> use shadcn-svelte toast (built-in)

## 8. Testing

- [x] 8.1 Configure Vitest for SvelteKit (`vitest.config.ts` with
      `@testing-library/svelte`)
- [x] 8.2 Port test setup files (`__tests__/setup.ts`, `__tests__/api/setup.ts`)
- [x] 8.3 Port test utilities (`test-helpers.ts`, `test-factories.ts`,
      `test-db.ts`)
- [x] 8.4 Port backend library tests (minimal changes - `lib/db/`, `lib/email/`,
      `lib/payment/`, `lib/services/`, `lib/gdpr/`, `lib/cron/`)
- [x] 8.5 Port API route tests (change import paths, use SvelteKit request
      helpers)
- [x] 8.6 Port component tests (rewrite with `@testing-library/svelte`)
- [x] 8.7 Port security tests (CSRF, webhook replay, cron HMAC, re-auth)
- [x] 8.8 Port page-level tests
- [x] 8.9 Verify all tests pass with `bun run test`

## 9. Infrastructure and Build

- [x] 9.1 Create `Dockerfile` for Bun + SvelteKit (multi-stage build)
- [x] 9.2 Create `migrate-and-start.sh` script for Bun runtime
- [x] 9.3 Update `Makefile` commands for Bun (replace pnpm references)
- [x] 9.4 Update `.github/workflows/` CI for Bun
- [x] 9.5 Update `docker-compose.yml` if frontend service definition changes
- [x] 9.6 Verify `bun run build` produces working production build
- [x] 9.7 Verify `bun run preview` serves production build correctly
- [x] 9.8 Verify Docker build works end-to-end
- [x] 9.9 Remove Next.js-specific files (`next.config.ts`, `next-env.d.ts`,
      `.next/`)

## 10. Cleanup

- [ ] 10.1 Remove all React/Next.js dependencies from `package.json`
- [ ] 10.2 Remove `next-auth` types from `types/next-auth.d.ts`
- [x] 10.3 Update `openspec/project.md` to reflect new tech stack
- [ ] 10.4 Verify full build + test suite passes
- [ ] 10.5 Manual smoke test of all major flows (auth, secret CRUD, check-in,
      payment, settings)
