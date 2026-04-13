# Security App Fixes Design

## Context

The current app has six application-level security issues that should be fixed
in code before a separate dependency-upgrade pass:

1. Admin email-failure endpoints use bearer-token auth with a dangerous fallback
   token.
2. Session revocation and password reset flows do not actually invalidate active
   JWT sessions.
3. Post-auth redirect targets accept unvalidated `callbackUrl` and `next`
   values.
4. Webhook idempotency is race-prone because duplicate detection is not atomic.
5. Password-reset and email-verification tokens are stored in plaintext.
6. The check-in endpoint logs token-bearing URLs.

This work will be executed in an isolated git worktree on branch
`security-app-fixes`.

## Goals

- Remove the admin auth fallback and align admin routes on one authorization
  model.
- Make session revocation claims true for active JWT sessions.
- Restrict post-auth redirects to internal or same-origin destinations.
- Prevent duplicate webhook deliveries from double-applying side effects.
- Stop storing high-value recovery and verification tokens in plaintext.
- Eliminate logging of active bearer tokens.

## Non-Goals

- Dependency upgrades from the audit pass.
- General cleanup of unrelated failing tests or existing type-check errors.
- Broader auth redesign beyond the specific revocation gap.

## Decision

Use domain-grouped remediation streams instead of one issue per subagent or one
giant implementation batch.

- Stream A: admin auth fallback and session revocation.
- Stream B: redirect validation.
- Stream C: webhook idempotency.
- Stream D: token hashing at rest.
- Stream E: check-in log sanitization.

This grouping keeps file overlap low while still allowing isolated TDD cycles
and focused review.

## Testing Strategy

Each stream follows red-green-refactor:

1. Add a focused failing regression test for the target behavior.
2. Run only the targeted test command and verify it fails for the intended
   reason.
3. Implement the smallest code change that makes the test pass.
4. Re-run the targeted test command.
5. After all streams complete, run broader verification commands.

Because the worktree baseline is already red from unrelated failures,
stream-level test commands must be narrow and explicit until the final
verification pass.

## Verification

After all streams are complete, run:

- `cd frontend && bun test`
- `cd frontend && bun run check`
- `cd frontend && bun run build`

If these still fail, report the exact remaining failures and distinguish
security-fix regressions from pre-existing repository failures.
