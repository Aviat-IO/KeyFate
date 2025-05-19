# Key Fate: A Dead Man's Switch — Project Overview

## Purpose

Key Fate is a secure dead man's switch platform. Users create secrets (e.g., private keys, sensitive info) that are disclosed to a chosen recipient if the user fails to check in. Designed for personal use (journalists, estate planning, crypto holders), with future B2B potential.

## Core User Story

- User signs up and authenticates (Google OAuth, email verification).
- User creates a secret, encrypts it client-side, and sets a check-in interval and recipient.
- User must check in periodically. If missed, reminders are sent.
- If user fails to check in after reminders, the secret is disclosed to the recipient at the predetermined time.

## Key Features

- Secret creation and end-to-end encryption (client-side; only user holds decryption key).
- Periodic check-in system with reminders (email/SMS planned).
- Recipient management and secure disclosure.
- Google OAuth and email-based authentication.
- Email verification for users and recipients.
- Modular, extensible architecture for future features (SMS, audit, B2B).

## High-Level Architecture

- **Frontend:** Next.js App Router, React, TailwindCSS, Shadcn/UI. Modular components, server components preferred, minimal client-side state.
- **Backend:** Supabase (Postgres DB, Auth, Edge Functions, migrations). Edge Functions handle reminders, check-ins, secret processing.
- **API:** Serverless routes for check-in, secret management, and recipient notification.

## Security Positioning

- Secrets are encrypted in the browser before storage; only the user knows the decryption key.
- No plaintext secrets are ever stored in the database.
- Authentication and recipient verification via email/SMS.
- Security best practices enforced throughout the stack.

## Extensibility

- Designed for personal use, but modular for B2B expansion.
- Codebase supports new features (SMS, 3rd-party audit, integrations) with minimal refactoring.

## Directory Structure (Key Folders)

- `frontend/`: Next.js app, components, pages, API routes, styles.
- `supabase/`: Edge Functions, migrations, database schema.
- `db/`: Database utilities or scripts.
- `docs/`: Documentation.
- `scripts/`: Automation and dev scripts.

## Future Work

- Terms of Service and Privacy Policy.
- SMS reminders and recipient verification.
- 3rd-party security audit.
- Enhanced B2B features and integrations.
- Enable Nostr integration so recipient can be an `npub` (this allows for uncensorable publications)
