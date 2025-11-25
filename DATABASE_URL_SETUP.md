# Database URL Configuration

## Overview

The application can construct `DATABASE_URL` from component parts, so you don't
need to store the full connection string in Doppler.

## Required Doppler Secrets

Add these secrets to your Doppler project for the `dev` config:

```bash
# Required (DB_PASSWORD already exists)
DB_HOST=127.0.0.1        # For local/bastion tunnel, or actual Cloud SQL host
DB_PORT=54321            # Bastion tunnel port, or 5432 for direct connection
DB_USER=postgres
DB_NAME=keyfate
DB_PASSWORD=<already-exists-in-doppler>
```

## How It Works

The code in `frontend/src/lib/db/index.ts` constructs the DATABASE_URL
automatically:

```typescript
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL; // Use if provided directly
  }

  // Construct from parts
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = process.env.DB_PORT || "5432";
  const dbUser = process.env.DB_USER || "postgres";
  const dbPassword = process.env.DB_PASSWORD || "dev_password_change_in_prod";
  const dbName = process.env.DB_NAME || "keyfate_dev";

  return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
}
```

## Environment-Specific Values

### Local Development

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_NAME=keyfate_dev
DB_PASSWORD=dev_password_change_in_prod
```

### Staging (via Bastion Tunnel)

```
DB_HOST=127.0.0.1
DB_PORT=54321                    # Bastion tunnel port
DB_USER=postgres
DB_NAME=keyfate
DB_PASSWORD=<staging-password>
```

### Production (via Bastion Tunnel)

```
DB_HOST=127.0.0.1
DB_PORT=54321                    # Bastion tunnel port
DB_USER=postgres
DB_NAME=keyfate_prod
DB_PASSWORD=<prod-password>
```

## Validation

The validation script (`scripts/validate-env.js`) accepts either:

1. `DATABASE_URL` alone, OR
2. All four component parts: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## Testing

After adding secrets to Doppler:

```bash
# Test that DATABASE_URL is constructed correctly
cd frontend
doppler run -p keyfate -c dev -- node -e "console.log(process.env.DATABASE_URL)"

# Should output something like:
# postgresql://postgres:hM65ANes82sH+hAmtmmhMB9@127.0.0.1:54321/keyfate
```

## Build

Once Doppler secrets are configured:

```bash
cd frontend
make build
```

This will:

1. Run `doppler run -p keyfate -c dev -- pnpm install`
2. Run `doppler run -p keyfate -c dev -- pnpm build:local`
3. Validation will pass because DB\_\* variables construct DATABASE_URL
