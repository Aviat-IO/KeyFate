# Self-hosting KeyFate alpha

This guide is for reviewers who want to run or evaluate KeyFate without private
project context.

## What you host

KeyFate is a SvelteKit 5 app backed by PostgreSQL. The Docker image runs Drizzle
migrations before starting the Node adapter build.

Required services:

- KeyFate frontend/API container (`frontend/Dockerfile`)
- PostgreSQL 16+

Optional production services:

- Google OAuth credentials for Auth.js
- SendGrid or SMTP for transactional email
- Stripe or BTCPay Server for payments
- A scheduler is built into the app; set `CRON_ENABLED=false` if an external
  scheduler owns cron endpoints.

## Local reviewer setup

Prerequisites:

- Bun
- Docker and Docker Compose

```bash
git clone https://github.com/Aviat-IO/KeyFate.git
cd KeyFate
cp frontend/.env.example frontend/.env.local
```

Start PostgreSQL:

```bash
docker-compose up -d postgres
```

Make `frontend/.env.local` match your local database. For the root
`docker-compose.yml` defaults, use:

```env
DATABASE_URL=postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev
AUTH_SECRET=replace-with-at-least-32-random-characters
NEXTAUTH_URL=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173
CRON_ENABLED=false
```

Install, migrate, and run:

```bash
cd frontend
bun install --frozen-lockfile
bunx drizzle-kit migrate
bun run dev
```

Open <http://localhost:5173>.

## Production-style Docker run

Build the app image from the frontend directory:

```bash
cd frontend
docker build -t keyfate-alpha .
```

Run with a reachable PostgreSQL database and required environment variables:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgresql://user:password@host:5432/keyfate' \
  -e AUTH_SECRET='replace-with-at-least-32-random-characters' \
  -e NEXTAUTH_URL='https://your-domain.example' \
  -e PUBLIC_SITE_URL='https://your-domain.example' \
  -e CRON_SECRET='replace-with-random-cron-secret' \
  keyfate-alpha
```

The container entrypoint runs `bunx drizzle-kit migrate` before starting the app.

## Required environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `AUTH_SECRET` | Yes | Auth.js signing/encryption secret. Use at least 32 random characters. |
| `NEXTAUTH_URL` | Yes | Canonical app URL for Auth.js callbacks. |
| `PUBLIC_SITE_URL` | Yes | Browser-visible canonical app URL. |
| `CRON_SECRET` | Production | Secret for cron API calls. |
| `CRON_ENABLED` | Optional | Set `false` to disable in-process cron locally. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | If Google auth enabled | Google OAuth provider credentials. |
| `SENDGRID_API_KEY` or SMTP variables | If email enabled | Transactional email provider. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | If Stripe enabled | Stripe payment integration. |
| `BTCPAY_*` | If BTCPay enabled | BTCPay Server payment integration. |

See [`frontend/.env.example`](../frontend/.env.example) for the full list.

## Operational checks

After deployment:

1. Visit `/api/health` and expect a healthy response.
2. Create a test account using the configured auth provider.
3. Confirm database migrations completed.
4. Confirm transactional email in a non-production mailbox.
5. Visit `/recover` and verify the page loads without signing in.
6. Use sample data only for alpha recovery tests.

## Security notes for alpha operators

- Do not use production crypto seeds or high-value secrets in alpha testing.
- Keep `AUTH_SECRET`, database credentials, email keys, payment keys, and cron
  secrets outside git.
- Use HTTPS in production so OAuth callbacks and recovery pages are not exposed
  over plaintext transport.
- Back up PostgreSQL and test restore procedures before relying on hosted data.
- Recovery inputs on `/recover` are intended to stay browser-local; still prefer
  a clean browser profile or offline-loaded page for sensitive tests.
