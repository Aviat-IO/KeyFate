# Google OAuth Env Design

## Context

The live app is healthy on Railway, but `/api/auth/providers` reports
`google: false` in both staging and production. The project stores Google OAuth
credentials in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, while Auth.js
auto-detects `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` when credentials are not
passed explicitly.

## Decision

Pass `process.env.GOOGLE_CLIENT_ID` and `process.env.GOOGLE_CLIENT_SECRET`
directly into `Google(...)` in `frontend/src/auth.ts`.

## Why

This is the smallest production fix. It aligns runtime behavior with the
existing Railway variables already used elsewhere in the app and avoids
depending on a second env naming scheme.

## Verification

- Unit test that `src/auth.ts` forwards `GOOGLE_CLIENT_*` into the Google
  provider.
- Deploy to Railway.
- Confirm `/api/auth/providers` returns `google: true` for staging and
  production.
