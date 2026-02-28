# Project Context

## Purpose

KeyFate is a secure dead man's switch platform using client-side Shamir's Secret
Sharing. Users create secrets (e.g., private keys, sensitive info) that are
disclosed to a chosen recipient if the user fails to check in. Secret creation
and recovery happen 100% client-side, ensuring we never have access to users'
original secrets. Designed for personal use (journalists, estate planning,
crypto holders), with future B2B potential.

## Tech Stack

### Frontend

- **Framework:** SvelteKit 5 (Svelte 5 with runes)
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS 4 (Vite plugin with v3-compat bridge via `@config`)
- **UI Components:** shadcn-svelte (21 components)
- **Icons:** Lucide Svelte
- **Forms:** Native Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- **State Management:** Svelte 5 runes, SvelteKit load functions

### Backend & Infrastructure

- **Runtime:** Bun
- **Database:** PostgreSQL 16
- **ORM:** Drizzle ORM
- **Authentication:** Auth.js v5 (`@auth/sveltekit`) with Google OAuth +
  Credentials providers
- **Encryption:** AES-256-GCM, Shamir's Secret Sharing
- **Email:** Nodemailer (SendGrid, Resend)
- **Payment Processing:** Stripe and BTCPay Server
- **Validation:** Zod v4

### Development & Testing

- **Testing Framework:** Vitest with @testing-library/svelte
- **Test Environment:** jsdom
- **Package Manager:** Bun
- **Build Tool:** Vite (via SvelteKit)
- **Container Orchestration:** Docker Compose
- **Linting:** ESLint with Svelte config
- **Formatting:** Prettier with Svelte and Tailwind plugins

### Deployment

- **Hosting:** Railway (target; migrating from GCP)
- **Adapter:** adapter-node (SvelteKit)
- **Container:** Docker (multi-stage Bun build, ~559MB image)
- **Database:** Railway PostgreSQL (target; migrating from Cloud SQL)
- **CI/CD:** GitHub Actions
- **Infrastructure as Code:** Terragrunt (GCP legacy, to be removed)

## Project Conventions

### Code Style

- Use TypeScript strictly with no implicit any
- Use Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`
- Use `onclick` not `on:click` (Svelte 5 event syntax)
- Use named exports over default exports
- Keep components modular and reusable
- NO comments unless explicitly requested
- Use Prettier for formatting with Svelte and Tailwind plugins
- Follow SvelteKit file-based routing conventions

### Naming Conventions

- Components: PascalCase (e.g., `SecretCard.svelte`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for utilities, PascalCase for components
- Database tables: snake_case
- Environment variables: UPPER_SNAKE_CASE with prefix patterns
- SvelteKit routes: lowercase with brackets for params (e.g., `[id]`)

### Architecture Patterns

- **Modular Components:** Reusable UI components in `src/lib/components/ui/`
- **Server-First:** SvelteKit load functions for data fetching, minimal
  client-side JS
- **API Routes:** RESTful patterns in `src/routes/api/` using `+server.ts`
- **Page Data:** `+page.server.ts` load functions for authenticated data
- **Database Access:** Drizzle ORM with type-safe queries
- **Security by Design:** Client-side encryption, zero-knowledge architecture
- **Threshold Security:** Shamir's Secret Sharing with minimum 2-of-3 shares
- **Environment Separation:** Development, staging, production with dedicated
  databases
- **Auth Pattern:** `event.locals.auth()` for session access, `requireSession()`
  helper for API routes

### Testing Strategy

- All code should be testable and have unit tests
- Use Vitest for unit and integration tests
- @testing-library/svelte for component tests
- Test environment: jsdom with fake timers
- Test coverage tracking with Vitest
- Mock external services (email, payment) in tests
- Mock `$env` modules in test setup
- Test database connections before migrations

### Git Workflow

- Never mention "Claude" as an author in commits
- Commit messages should be clear and concise (1-2 sentences)
- Focus commit messages on "why" rather than "what"
- Do NOT commit unless explicitly requested by user
- Run lint and typecheck commands before committing if available
- Use feature branches for development
- Test changes locally before deployment

## Domain Context

### Security Model

- **Zero-Knowledge Architecture:** Original secrets never leave user's device
- **Shamir's Secret Sharing:** Secrets split using configurable threshold
  schemes
  - Free tier: Fixed 2-of-3 (2 shares required from 3 total)
  - Pro tier: Configurable 2-of-N up to 7 shares (e.g., 3-of-5, 4-of-7)
- **Server Storage:** Only one encrypted share stored (insufficient to
  reconstruct)
- **Mathematical Guarantee:** Impossible to reconstruct secrets from server
  alone
- **Client-Side Encryption:** All secret processing happens in browser
- **AES-256-GCM:** Industry-standard encryption for stored shares
- **Audit Logging:** Pro users have comprehensive activity logs stored
  indefinitely

### Business Model

- **Free Tier:** 1 secret, 1 recipient (email only), limited check-in intervals
  (1 week, 1 month, 1 year only), 2-of-3 Shamir threshold (fixed), no message
  templates, no audit logs, community support
- **Pro Tier:** 10 secrets, 5 recipients per secret (email only), flexible
  custom intervals (1 day to 3 years), configurable Shamir threshold (2-of-N up
  to 7 shares), 7 message templates, comprehensive audit logs, priority email
  support (support@keyfate.com)
- **Downgrade Policy:** Users who downgrade keep existing secrets but cannot
  create new ones if over limit (grandfathering)
- **Subscription Management:** Stripe and BTCPay Server integration
- **Contact Methods:** Email only (SMS/phone deferred to future)
- **Pro Features Constant:** All Pro features defined in
  `frontend-svelte/src/constants/pro-features.ts` with title, description, and
  optional features list
- **Future Plans:** SMS notifications, B2B features, Nostr integration, Bitcoin
  CSV timelocks for trustless disclosure

### Check-In System

- Users must periodically check in to prevent secret disclosure
- Automated reminders sent before deadline (email/SMS planned)
- Graduated reminder schedule (25%, 50%, 7 days, 3 days, 24h, 12h, 1h)
- Triggered secrets disclosed to recipients automatically
- Cron job authentication required for automated tasks

## Important Constraints

### Security Constraints

- Never store plaintext secrets in database
- Never store sufficient shares to reconstruct secrets
- Always use client-side encryption for secret processing
- Require email verification for users and recipients
- Enforce TLS/SSL in production environments
- Never log or expose encryption keys, secrets, or sensitive data
- Implement proper authentication for all cron jobs and webhooks

### Technical Constraints

- PostgreSQL 16 required for database features
- Bun runtime required
- TypeScript strict mode enabled
- SvelteKit 5 with Svelte 5 runes only (no legacy `$:` or `export let`)
- All authentication through Auth.js (`@auth/sveltekit`)
- Database migrations via Drizzle ORM only (`drizzle-kit generate`)
- SvelteKit adapter-node for deployment

### Business Constraints

- **Free tier limits:**
  - 1 secret (active or paused), 1 recipient (email only), 3 check-in intervals
    (7d, 30d, 365d)
  - Fixed 2-of-3 Shamir threshold (no configuration)
  - No message templates, no audit logs, community support only
- **Pro tier limits:**
  - 10 secrets (active or paused), 5 recipients per secret (email only), 9
    custom intervals (1d to 3y)
  - Configurable Shamir threshold: 2-of-N up to 7 shares
  - 7 message templates (Bitcoin Wallet, Password Manager, Estate Documents,
    Safe Deposit Box, Cryptocurrency Exchange, Cloud Storage, Social Media)
  - Comprehensive audit logs (stored indefinitely)
  - Priority email support: support@keyfate.com
- **Tier enforcement:** Must be validated server-side in all API endpoints (not
  just UI)
- **Secret limit counting:** Count secrets with `status = 'active'` OR
  `status = 'paused'` (only exclude `triggered` and deleted secrets)
- **Downgrade handling:** Grandfather existing secrets, prevent new secret
  creation if over new limit
- **Usage tracking:** Calculate on-demand from database for accuracy
- **Payment processing:** Stripe and BTCPay Server
- **Contact methods:** Email only until SMS feature is implemented
- **UI Components:** shadcn-svelte with theme defined in
  `frontend-svelte/src/app.css`
- **Pro Features Reference:** All Pro features centralized in
  `frontend-svelte/src/constants/pro-features.ts`

## External Dependencies

### Required Services

- **Google OAuth:** User authentication provider
- **SendGrid/Resend:** Email delivery service
- **Stripe:** Credit card payment processing and subscription management
- **BTCPay Server:** Bitcoin payment processing (self-hosted)
- **Railway PostgreSQL:** Managed PostgreSQL database (target)

### Optional Services

- **Redis:** Session caching (optional)
- **SMS Provider:** Future feature for notifications (not currently implemented)
- **Nostr Network:** Future integration for censorship-resistant share storage
- **Bitcoin Network:** Future integration for CSV timelock-based trustless
  disclosure

### Development Tools

- **Docker:** Local service orchestration
- **Bun:** Runtime and package manager
- **Drizzle Kit Studio:** Database GUI
- **GitHub Actions:** CI/CD pipeline
