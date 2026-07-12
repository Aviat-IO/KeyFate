# Progress

## Status
Complete. Draft PR opened: https://github.com/Aviat-IO/KeyFate/pull/17

## Tasks
- Added a reproducible Bitcoin CSV timelock demo builder for signet/testnet P2WSH outputs.
- Added a Bun CLI: `cd frontend && bun run bitcoin:timelock-demo`.
- Added deterministic test-vector coverage for the demo output.
- Documented CSV vs CLTV tradeoffs, Nostr disclosure complement, limitations, and production caveats.
- Committed and pushed `agent/issue-6`.

## Files Changed
- `docs/BITCOIN_TIMELOCK_DEMO.md`
- `frontend/package.json`
- `frontend/scripts/bitcoin-timelock-demo.ts`
- `frontend/src/lib/__tests__/bitcoin-timelock-demo.test.ts`
- `frontend/src/lib/bitcoin/index.ts`
- `frontend/src/lib/bitcoin/script.ts`
- `frontend/src/lib/bitcoin/timelock-demo.ts`

## Validation
- Passed: `cd frontend && bun run bitcoin:timelock-demo`
- Passed: `cd frontend && bun run test src/lib/__tests__/bitcoin-timelock-demo.test.ts`
- Passed: `cd frontend && bun run check`
- Passed: `cd frontend && bun run build`
- Failed pre-existing/global: `cd frontend && bun run test` fails on many existing `$lib/...` alias resolution errors unrelated to the issue #6 files.

## Notes
- Requested `context.md` and `plan.md` were not present in the worktree.
- Demo intentionally builds a timelocked output/address scaffold, not a live wallet-funded PSBT/broadcast transaction.
