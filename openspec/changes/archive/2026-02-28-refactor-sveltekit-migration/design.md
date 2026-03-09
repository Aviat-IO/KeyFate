## Context

KeyFate is migrating from Next.js 15 (React) to SvelteKit 5 (Svelte) with Bun as
the runtime and package manager. This is a full rewrite of the frontend layer
while preserving all backend business logic (Drizzle ORM, encryption, payment
providers, email services). The app has zero users, making this the ideal time
for a framework migration.

## Goals / Non-Goals

- Goals:
  - Lighter, faster application suitable for a "thin convenience layer" role
  - Bun as the single runtime (replaces Node.js, pnpm, and npm scripts)
  - Svelte 5 runes for reactivity (no React hooks, no virtual DOM)
  - Maintain feature parity with the current Next.js app
  - Keep Drizzle ORM, PostgreSQL, and all business logic unchanged
  - Keep Tailwind CSS for styling
  - Maintain test coverage

- Non-Goals:
  - Adding new features during migration (feature freeze)
  - Changing the database schema
  - Changing business logic or API contracts
  - Migrating to a different database
  - Implementing Nostr/Bitcoin features (separate change proposal)

## Decisions

### Framework: SvelteKit 5

- SvelteKit is the official Svelte meta-framework (equivalent to Next.js for
  React)
- Svelte 5 uses runes (`$state`, `$derived`, `$effect`) instead of the older
  `$:` reactivity
- SvelteKit uses Vite natively (no Turbopack dependency)
- File-based routing with `+page.svelte`, `+page.server.ts`, `+server.ts`
  conventions

### Runtime: Bun

- Bun replaces Node.js as the JavaScript runtime
- Bun replaces pnpm as the package manager (`bun install`, `bun add`)
- Bun's built-in test runner replaces Vitest for unit tests (evaluate
  compatibility; may keep Vitest if Bun test runner lacks features)
- Dockerfile changes from `node:22-alpine` to `oven/bun:1`

### Auth: @auth/sveltekit

- Auth.js (formerly NextAuth v5) has a first-class SvelteKit adapter
- Session handling moves to `hooks.server.ts` (SvelteKit's middleware
  equivalent)
- Google OAuth and credentials providers are supported
- JWT strategy remains the same

### UI Components: shadcn-svelte

- shadcn-svelte is the official Svelte port of shadcn/ui
- Uses Bits UI (Svelte equivalent of Radix UI) for accessible primitives
- Tailwind CSS styling is identical
- Component API is similar but uses Svelte syntax

### Routing Migration Map

| Next.js Pattern          | SvelteKit Equivalent                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `app/page.tsx`           | `src/routes/+page.svelte`                                                             |
| `app/layout.tsx`         | `src/routes/+layout.svelte`                                                           |
| `app/(group)/page.tsx`   | `src/routes/(group)/+page.svelte`                                                     |
| `app/api/route.ts`       | `src/routes/api/+server.ts`                                                           |
| `app/[slug]/page.tsx`    | `src/routes/[slug]/+page.svelte`                                                      |
| `middleware.ts`          | `src/hooks.server.ts`                                                                 |
| `'use client'` directive | Default in Svelte (all components are client-rendered unless using `+page.server.ts`) |
| Server Components        | `+page.server.ts` load functions                                                      |
| `getServerSession()`     | `event.locals.session` via hooks                                                      |

### Testing Strategy

- Vitest remains the test runner (better SvelteKit integration than Bun test
  runner currently)
- `@testing-library/svelte` replaces `@testing-library/react`
- API route tests need minimal changes (test the handler functions directly)
- Backend library tests (`lib/db/`, `lib/email/`, `lib/payment/`) need zero
  framework changes

## Risks / Trade-offs

- Risk: Auth.js SvelteKit adapter is less mature than NextAuth v4 -> Mitigation:
  Auth.js is actively maintained; fall back to custom auth if needed
- Risk: shadcn-svelte lags behind shadcn/ui in component availability ->
  Mitigation: Bits UI provides all required primitives; custom components where
  needed
- Risk: Bun compatibility with some npm packages -> Mitigation: Bun has
  excellent Node.js compatibility; test early with `shamirs-secret-sharing` and
  `bcryptjs`
- Risk: 139 test files need rewriting -> Mitigation: Backend tests (lib/) need
  minimal changes; only component tests need full rewrite
- Risk: Migration takes longer than expected -> Mitigation: Zero users means no
  deadline pressure; migrate incrementally by route group

## Migration Plan

The migration follows a bottom-up approach:

1. **Scaffold** - Create SvelteKit project with Bun, configure Drizzle,
   Tailwind, Auth.js
2. **Backend first** - Port all `lib/` modules (most are framework-agnostic)
3. **API routes** - Port all 60 API endpoints to `+server.ts`
4. **Auth** - Set up Auth.js with hooks.server.ts, port middleware logic
5. **UI components** - Install shadcn-svelte, port all components
6. **Pages** - Port all 39 pages by route group
7. **Tests** - Port all test files
8. **Infrastructure** - Update Dockerfile, build scripts, CI/CD

## Open Questions

1. Should we keep Vitest or switch to Bun's built-in test runner?
2. Should we use SvelteKit's form actions for mutations, or keep the existing
   fetch-to-API-route pattern?
3. Should we use SvelteKit's native adapter-node for deployment, or adapter-bun?
