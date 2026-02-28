## Why

The application is being rearchitected toward a decentralized Nostr + Bitcoin
model where the server becomes a thin convenience layer. Next.js is heavyweight
for this role: large bundle sizes, React hydration overhead, Vercel-optimized
deployment patterns, and Node.js-only runtime. SvelteKit 5 with Bun provides a
lighter foundation (smaller bundles, faster builds, simpler mental model) better
suited for an app trending toward minimal server dependency. Bun replaces
Node.js, pnpm, and Vitest's Node runtime with a single, faster tool.

## What Changes

- **BREAKING**: Rewrite all 39 pages from React/Next.js to Svelte/SvelteKit 5
- **BREAKING**: Rewrite all 60 API routes from Next.js route handlers to
  SvelteKit `+server.ts` endpoints
- **BREAKING**: Replace NextAuth.js v4 with `@auth/sveltekit` (Auth.js)
- **BREAKING**: Replace shadcn/ui (React/Radix) with shadcn-svelte (Bits UI) or
  equivalent
- **BREAKING**: Replace React hooks with Svelte 5 runes (`$state`, `$derived`,
  `$effect`)
- **BREAKING**: Replace `middleware.ts` with SvelteKit `hooks.server.ts`
- **BREAKING**: Rewrite all ~139 test files for SvelteKit + Bun test runner
- **BREAKING**: Replace pnpm with Bun for package management
- **BREAKING**: Replace Node.js runtime with Bun
- Replace Tailwind CSS 3 with Tailwind CSS 4 (Svelte ecosystem default)
- Replace `next.config.ts` with `svelte.config.js` + `vite.config.ts`
- Replace Dockerfile (node:22-alpine to oven/bun)
- Drizzle ORM, Zod, and PostgreSQL remain unchanged
- Stripe, BTCPay, SendGrid integrations remain (backend logic portable)

## Impact

- Affected specs: `infrastructure`, `authentication`
- Affected code: **Entire `frontend/` directory** is rewritten
- Non-affected: `infrastructure/` (Terraform/Terragrunt), `database/`,
  `openspec/`, `docs/`, `scripts/`
- Non-affected: Drizzle schema (`src/lib/db/schema.ts`), encryption logic,
  payment provider logic, email service logic (all backend, framework-agnostic)
