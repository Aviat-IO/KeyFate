# KeyFate Rearchitecture: SvelteKit + Nostr + Bitcoin Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Rearchitect KeyFate from a centralized Next.js/GCP application to a
decentralized SvelteKit/Bun application with Nostr + Bitcoin hybrid disclosure,
deployed on Railway for ~$5/month.

**Architecture:** The server becomes a thin convenience layer. Bitcoin CSV
timelocks enforce trustless disclosure timing. Nostr relays persist encrypted
shares. The web UI provides a friendly interface for the happy path, while the
Bitcoin + Nostr layer ensures secrets get disclosed even if KeyFate's servers
are seized or the operator disappears.

**Tech Stack:** SvelteKit 5, Svelte 5 runes, Bun, Drizzle ORM, PostgreSQL,
Auth.js, shadcn-svelte, Tailwind CSS 4, nostr-tools, bitcoinjs-lib, Railway

---

## Execution Order

These three change proposals MUST be executed in order:

### Phase 1: SvelteKit Migration (`refactor-sveltekit-migration`)

Rewrite the entire frontend from Next.js/React to SvelteKit 5/Svelte with Bun.
This is the foundation — all subsequent work builds on the new framework.

**Estimated effort:** 2-4 weeks **Tasks:** 155 items across 10 sections

### Phase 2: Hosting Migration (`refactor-hosting-migration`)

Move from GCP ($100+/month) to Railway ($5/month). This depends on Phase 1
because the Dockerfile and build process change with SvelteKit.

**Estimated effort:** 1-2 days **Tasks:** 26 items across 7 sections

### Phase 3: Bitcoin + Nostr Hybrid (`refactor-service-continuity-bitcoin`)

Add decentralized disclosure via Nostr relays and Bitcoin CSV timelocks. This
builds on the SvelteKit codebase from Phase 1 and the Railway deployment from
Phase 2.

**Estimated effort:** 3-5 weeks **Tasks:** 38 items across 7 sections

**Total estimated effort:** 6-10 weeks

---

## Key Design Decisions

1. **SvelteKit over Next.js** — lighter bundles, simpler reactivity model,
   better suited for a "thin convenience layer" that may eventually become
   optional
2. **Bun over Node.js** — faster builds, built-in package manager, single tool
   replaces Node + pnpm
3. **Railway over GCP** — 95% cost reduction, zero ops burden, disposable when
   server becomes irrelevant
4. **Bitcoin CSV over CLTV** — relative timelocks map naturally to "time since
   last check-in"
5. **Double encryption** — ChaCha20 (quantum-safe) + NIP-44 (convenient) +
   optional passphrase (quantum-safe backup)
6. **Nostr for data persistence, Bitcoin for timing enforcement** — each
   protocol does what it's best at
