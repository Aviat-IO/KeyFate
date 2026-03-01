# Agent Instructions

## General Instructions

- Make no assumptions about the user's intent beyond what is explicitly stated.
- Be adversarial. The goal is to have the best code not be kind to the user.
- Be as brief as possible while still being clear.
- After any changes, ensure the app builds and the test suite passes.

## Project Structure

```
frontend-svelte/     # SvelteKit 5 app (primary — all development here)
frontend/            # Next.js 15 app (legacy reference — DO NOT modify)
openspec/            # Spec-driven development proposals
docs/plans/          # Architecture design documents
```

## Tech Stack

- **Framework**: SvelteKit 5 with Svelte 5 runes (`$state`, `$derived`,
  `$effect`, `$props`)
- **Runtime**: Bun (not Node.js, npm, or pnpm)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Auth.js v5 (`@auth/sveltekit`) — Google OAuth + OTP credentials
- **Styling**: Tailwind CSS 4 + shadcn-svelte components from
  `$lib/components/ui/`
- **Crypto**: `@noble/ciphers`, `@scure/btc-signer`, Web Crypto API
- **Hosting**: Railway (Docker-based deploys)

## Build & Test Commands

```bash
cd frontend-svelte
bun run build          # Build the SvelteKit app
bun test               # Run all 303 tests
bun run check          # Svelte type checking
```

## Tool Usage

- Use context7 MCP when looking for documentation
- If you still fail to find documentation use the web search tool
- Use `rg` (ripgrep) instead of `grep` for searching
- For policy document changes, see `@/POLICY_DOCUMENT_PROCESS.md`

## Svelte 5 Conventions

- Use Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`
- Do NOT use legacy `$:` reactive declarations or `export let`
- Use `onclick` not `on:click` (Svelte 5 event syntax)
- Use semantic colors ONLY (primary, destructive, muted, etc.) — NEVER literal
  colors like "blue", "red", "green"
- Reference https://shadcn-svelte.com/ for component APIs

## Bun Test Compatibility

Do NOT use these Vitest APIs (they don't work in Bun):

- `vi.mocked()` — use `(myFn as ReturnType<typeof vi.fn>).mockX()` instead
- `vi.stubEnv()` — use `process.env.KEY = value` instead
- `vi.stubGlobal()` — use `globalThis.fetch = vi.fn()` instead
- `vi.resetModules()` — avoid, restructure tests instead

## Database Migrations (Drizzle ORM)

**CRITICAL: Always use `drizzle-kit generate` to create migrations**

### Creating Migrations

```bash
cd frontend-svelte
bunx drizzle-kit generate --name="description_of_change"
```

This creates THREE required files:

1. SQL file in `drizzle/NNNN_name.sql`
2. Snapshot JSON in `drizzle/meta/NNNN_name_snapshot.json`
3. Updates `drizzle/meta/_journal.json`

### NEVER Do This

- Manually create SQL files in `drizzle/`
- Edit migration files after generation
- Skip `drizzle-kit generate` and create SQL directly

### Why This Matters

Drizzle's migration runner requires BOTH the SQL file AND snapshot JSON. Missing
snapshots cause migrations to be silently skipped, leading to schema drift.

### Workflow

1. Modify `frontend-svelte/src/lib/db/schema.ts`
2. Run `bunx drizzle-kit generate --name="your_change"`
3. Review generated SQL in `drizzle/NNNN_*.sql`
4. Test locally: `bunx drizzle-kit migrate`
5. Commit ALL three files (SQL, snapshot JSON, \_journal.json)

## Railway Deployment

### Architecture

- **Project**: `keyfate` on Railway
- **Environments**: `staging` and `production`
- **Service**: `dead-mans-switch` (Docker-based, Dockerfile at
  `frontend-svelte/Dockerfile`)
- **Database**: PostgreSQL plugin in each environment
- **Root directory**: `/frontend-svelte` (configured in Railway service
  settings)

### Domains

| Environment | Railway Domain                               | Custom Domain         |
| ----------- | -------------------------------------------- | --------------------- |
| Production  | `dead-mans-switch-production.up.railway.app` | `keyfate.com`         |
| Staging     | `dead-mans-switch-staging.up.railway.app`    | `staging.keyfate.com` |

### Deploying

Railway auto-deploys on push to the connected branch. For manual deploys:

```bash
cd frontend-svelte

# Deploy to staging
railway up --service dead-mans-switch -e staging

# Deploy to production
railway up --service dead-mans-switch -e production
```

### CRITICAL: Always Check Deployment Status After Deploying

After every deploy (push or `railway up`), verify the deployment succeeded:

```bash
# Check deployment status (look for latestDeployment.status)
railway status --json 2>&1 | jq '.environments.edges[].node | {
  name: .name,
  latestStatus: .serviceInstances.edges[0].node.latestDeployment.status,
  activeStatus: .serviceInstances.edges[0].node.activeDeployments[0].status,
  configErrors: .serviceInstances.edges[0].node.latestDeployment.meta.configErrors
}'

# Check runtime logs
railway logs --service dead-mans-switch -e production
railway logs --service dead-mans-switch -e staging
```

**Common failure**: Railway auto-deploy fails with
`"Could not find root directory: /frontend-svelte"` if service settings get
reset. Verify the root directory and Dockerfile path are set in Railway
dashboard or use `railway up` which builds locally.

### Key Environment Variables

Secrets are managed in Railway's service variables (not in git):

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `DATABASE_URL` (auto-injected by Railway Postgres plugin)
- `CRON_SECRET`, `CRON_ENABLED`
- `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ORIGIN` (set to custom domain URL for each environment)

### Cron Jobs

The app uses in-process `node-cron` scheduler (no external cron service). It
self-invokes API endpoints via `http://127.0.0.1:PORT/api/cron/*`. The scheduler
waits for the HTTP server to be ready before starting.

### Docker Build

The Dockerfile is a multi-stage Bun build:

1. `deps` stage: `bun install --frozen-lockfile`
2. `builder` stage: `bun run build`
3. `runner` stage: copies `build/`, `node_modules/`, `drizzle/`, runs
   `migrate-and-start.sh`

If `bun install --frozen-lockfile` fails, regenerate the lockfile:

```bash
cd frontend-svelte
bun install    # Regenerates bun.lock
```

<!-- OPENSPEC:START -->

## OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big
  performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
