# Agent Instructions

## General Instructions

- Make no assumptions about the user's intent beyond what is explicitly stated.
- Be adversarial. The goal is to have the best code not be kind to the user.
- Be as brief as posible while still being clear.
- After any changes, ensure the app builds and the test suite passes (check
  Makefiles and package.json for commands).

## Tool Usage

- Use context7 MCP when looking for documentation
- If you still fail to find documentation use the web search tool or Chrome MCP
  tool
- Use `rg` (ripgrep) instead of `grep` for searching
- For policy document changes, see `@/POLICY_DOCUMENT_PROCESS.md`

## Database Migrations (Drizzle ORM)

**CRITICAL: Always use `drizzle-kit generate` to create migrations**

### Creating Migrations

```bash
# CORRECT way to create migrations
npx drizzle-kit generate --name="description_of_change"
```

This creates THREE required files:

1. SQL file in `drizzle/NNNN_name.sql`
2. Snapshot JSON in `drizzle/meta/NNNN_name_snapshot.json`
3. Updates `drizzle/meta/_journal.json`

### NEVER Do This

❌ Manually create SQL files in `drizzle/` ❌ Edit migration files after
generation ❌ Skip `drizzle-kit generate` and create SQL directly

### Why This Matters

Drizzle's migration runner requires BOTH the SQL file AND snapshot JSON. Missing
snapshots cause migrations to be silently skipped, leading to schema drift.

### Workflow

1. Modify `src/lib/db/schema.ts`
2. Run `npx drizzle-kit generate --name="your_change"`
3. Review generated SQL in `drizzle/NNNN_*.sql`
4. Test locally: `npm run db:migrate -- --config=drizzle.config.ts`
5. Commit ALL three files (SQL, snapshot JSON, _journal.json)

### Resetting Database (Staging Only)

If migrations are broken and staging has no critical data:

```bash
cd frontend
./reset-staging-db.sh  # Drops and recreates database
# Then run migrations fresh
```

## Infrastructure Instructions

- Use Terragrunt for all infrastructure.
- Prefer using Google Cloud and
  [Cloud Foundation Fabric modules](https://github.com/GoogleCloudPlatform/cloud-foundation-fabric/tree/master/modules)
- Do NOT run any commands that create or modify cloud resources directly. Only
  use Terragrunt to manage infrastructure.

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
