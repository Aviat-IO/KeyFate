<!-- OPENSPEC:START -->

# OpenSpec Instructions

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

## Global Decision Engine

**Import minimal routing and auto-delegation decisions only, treat as if import
is in the main CLAUDE.md file.** @./.claude-collective/DECISION.md

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if
import is in the main CLAUDE.md file.** @./.taskmaster/CLAUDE.md

## Policy Document Management

For creating or updating Privacy Policy or Terms of Service, see
`@/POLICY_DOCUMENT_PROCESS.md`

## Database Migrations (Drizzle ORM)

**ALWAYS use `drizzle-kit generate` - NEVER manually create SQL files**

### The Right Way

```bash
# 1. Edit schema
vim src/lib/db/schema.ts

# 2. Generate migration (creates SQL + snapshot + journal entry)
npx drizzle-kit generate --name="add_user_preferences"

# 3. Review and test
npm run db:migrate -- --config=drizzle.config.ts

# 4. Commit all generated files
git add drizzle/
```

### Why Snapshots Matter

Drizzle requires BOTH:

- `drizzle/NNNN_name.sql` (the migration)
- `drizzle/meta/NNNN_name_snapshot.json` (schema state)

Missing snapshots = **migrations silently skipped** = schema drift = production
bugs.

**Never** manually create migrations without `drizzle-kit generate`.
