# Development Progress

## Completed Features

### Core Functionality
- [x] Next.js 15 app with App Router
- [x] PostgreSQL database setup (Cloud SQL production, Docker local)
- [x] Google OAuth login with NextAuth.js
- [x] Enable users to create secrets
- [x] Client-side Shamir's Secret Sharing implementation
- [x] Secret management (pause/resume functionality)
- [x] Check-in system with reminders
- [x] Email-based reminder system
- [x] Secret details page with Shamir's sharing
  - [x] Users can delete the server's share (with appropriate warnings)
  - [x] Users can reveal the server's share (decrypt on server with warnings)
- [x] Sign up link from sign in form
- [x] Terms of Service and Privacy Policy (awaiting legal review)

### Testing & Quality
- [x] Comprehensive unit testing framework (179 passing tests across 19 test files)
  - [x] Utility functions & core logic (33 tests)
  - [x] Database & integration (12 tests)
  - [x] React components (92 tests)
  - [x] UI components (29 tests)
  - [x] Custom hooks (20 tests)
  - [x] Test setup & configuration (2 tests)

### Infrastructure
- [x] Docker Compose setup for local development
- [x] Terraform/Terragrunt infrastructure as code
- [x] Cloud Run deployment configuration
- [x] Cloud SQL with private IP
- [x] Database migrations via Drizzle ORM
- [x] Environment separation (dev, staging, production)

## In Progress

### Payment Integration
- [ ] Stripe credit card processing
- [ ] BTCPay Server Bitcoin payments
- [ ] Subscription management
- [ ] Tier enforcement (partial - needs completion)
- [ ] Webhook handling
- [ ] Usage tracking and limits

### Authentication & Security
- [ ] Email verification for user.meta.email_verified
- [ ] OTP-based email verification

## Planned Features

### Core Features
- [ ] Automatic expiration of triggered secrets (GDPR compliance)
  - [ ] Daily cron job to delete expired secrets
- [ ] User account deletion process (GDPR compliance)
- [ ] Unauthenticated Shamir's Secret Sharing explorer
  - [ ] Secret reconstruction from shares
  - [ ] Share generation (with disclaimers)

### Testing Expansion
- [ ] Form component tests
- [ ] API route handler tests
- [ ] Authentication middleware tests
- [ ] Integration tests for complete user flows
- [ ] Error handling and edge case tests

### Deployment
- [ ] Production deployment confidence
- [ ] Database management procedures
- [ ] Rollback procedures
- [ ] Monitoring and alerting

## v2 Features (Future)

- [ ] SMS reminders and notifications
- [ ] Contact storage and management
  - [ ] Import from Google Contacts
  - [ ] Import from Apple Contacts
- [ ] 3rd-party security audit
- [ ] Message templates (requirements pending)
- [ ] Nostr integration for uncensorable disclosure
- [ ] B2B features and enhancements

## Known Issues & Technical Debt

- Email verification flow incomplete
- Tier enforcement needs server-side validation in all API endpoints
- Payment integration incomplete
- GDPR compliance features pending
- Production deployment procedures need refinement
