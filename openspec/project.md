# Project Context

## Purpose

KeyFate is a secure dead man's switch platform using client-side Shamir's Secret Sharing. Users create secrets (e.g., private keys, sensitive info) that are disclosed to a chosen recipient if the user fails to check in. Secret creation and recovery happen 100% client-side, ensuring we never have access to users' original secrets. Designed for personal use (journalists, estate planning, crypto holders), with future B2B potential.

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS, Shadcn UI
- **UI Components:** Radix UI primitives
- **Icons:** Lucide React, Remix Icon
- **Forms:** React Hook Form with Zod validation
- **State Management:** React hooks, nuqs for URL search parameters

### Backend & Infrastructure
- **Database:** PostgreSQL 16
- **ORM:** Drizzle ORM
- **Authentication:** NextAuth.js v4 with Google OAuth
- **Encryption:** AES-256-GCM, Shamir's Secret Sharing
- **Email:** Nodemailer (SendGrid, Resend)
- **Payment Processing:** Stripe and BTCPay Server

### Development & Testing
- **Testing Framework:** Vitest with React Testing Library
- **Test Environment:** jsdom
- **Package Manager:** pnpm
- **Build Tool:** Next.js with Turbopack
- **Container Orchestration:** Docker Compose
- **Linting:** ESLint with Next.js config
- **Formatting:** Prettier with Tailwind plugin

### Deployment
- **Cloud Platform:** Google Cloud Platform
- **Compute:** Cloud Run
- **Database:** Cloud SQL (PostgreSQL with private IP)
- **Infrastructure as Code:** Terraform, Terragrunt
- **CI/CD:** Custom scripts, Makefile automation

## Project Conventions

### Code Style
- Use TypeScript strictly with no implicit any
- Prefer functional components with TypeScript interfaces
- Use named exports over default exports
- Server components by default; use `'use client'` only for Web API access
- Keep components modular and reusable
- NO comments unless explicitly requested
- Use Prettier for formatting with Tailwind plugin
- Follow Next.js App Router conventions

### Naming Conventions
- Components: PascalCase (e.g., `SecretForm.tsx`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for utilities, PascalCase for components
- Database tables: snake_case
- Environment variables: UPPER_SNAKE_CASE with prefix patterns

### Architecture Patterns
- **Modular Components:** Reusable UI components in `components/ui/`
- **Server-First:** Prefer server components, minimize client-side JavaScript
- **API Routes:** RESTful patterns in `app/api/`
- **Database Access:** Drizzle ORM with type-safe queries
- **Security by Design:** Client-side encryption, zero-knowledge architecture
- **Threshold Security:** Shamir's Secret Sharing with minimum 2-of-3 shares
- **Environment Separation:** Development, staging, production with dedicated databases

### Testing Strategy
- All code should be testable and have unit tests
- Use Vitest for unit and integration tests
- React Testing Library for component tests
- Test environment: jsdom with fake timers
- Test coverage tracking with Vitest
- Mock external services (email, payment) in tests
- Infrastructure validation scripts for deployment
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
- **Shamir's Secret Sharing:** Secrets split into 3 shares (2-of-3 threshold)
- **Server Storage:** Only one encrypted share stored (insufficient to reconstruct)
- **Mathematical Guarantee:** Impossible to reconstruct secrets from server alone
- **Client-Side Encryption:** All secret processing happens in browser
- **AES-256-GCM:** Industry-standard encryption for stored shares

### Business Model
- **Free Tier:** 1 secret, 1 recipient, limited check-in intervals (week/month/year)
- **Pro Tier:** 10 secrets, 5 recipients per secret, flexible intervals, message templates
- **Subscription Management:** Paddle Billing integration
- **Future Plans:** SMS notifications, B2B features, Nostr integration

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
- Private IP for Cloud SQL in production
- Node.js 18+ required
- TypeScript strict mode enabled
- Next.js 15 App Router patterns only
- All authentication through NextAuth.js
- Database migrations via Drizzle ORM only

### Business Constraints
- Free tier limits: 1 secret, 1 recipient
- Pro tier limits: 10 secrets, 5 recipients per secret
- Subscription tiers enforced at API level
- Usage tracking for tier enforcement
- Payment processing through Paddle (merchant of record)

## External Dependencies

### Required Services
- **Google OAuth:** User authentication provider
- **SendGrid/Resend:** Email delivery service
- **Paddle Billing:** Subscription and payment management
- **Google Cloud SQL:** Managed PostgreSQL database
- **Google Cloud Run:** Container hosting
- **Google Secret Manager:** Secure key storage

### Optional Services
- **Redis:** Session caching (optional)
- **SMS Provider:** Future feature for notifications
- **Nostr Network:** Future integration for censorship-resistant disclosure

### Development Tools
- **Docker:** Local service orchestration
- **Cloud SQL Proxy:** Local database access
- **Terraform/Terragrunt:** Infrastructure provisioning
- **Drizzle Kit Studio:** Database GUI
