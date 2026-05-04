# KeyFate public alpha release package

Issue: [#10](https://github.com/Aviat-IO/KeyFate/issues/10)

Target version: `v0.1.0-alpha.1` (review candidate; tag not cut by this PR)

## Reviewer goal

Give funders and external reviewers one stable artifact they can use without
private context:

- run KeyFate locally,
- evaluate the zero-knowledge recovery model,
- review self-hosting requirements,
- follow demo walkthroughs for Nostr, Bitcoin/offline recovery, and the product
  path.

## Alpha scope

### Included

- SvelteKit 5 application with Auth.js authentication.
- PostgreSQL persistence via Drizzle migrations.
- Client-side secret splitting/encryption flows.
- `/recover` browser-only recovery page with Nostr, Bitcoin transaction, and
  passphrase paths.
- Railway/Docker production path and local Docker PostgreSQL development path.
- Draft self-hosting guide: [`docs/self-hosting.md`](../self-hosting.md).
- Demo walkthrough outlines:
  - [`docs/demos/product-walkthrough.md`](../demos/product-walkthrough.md)
  - [`docs/demos/nostr-recovery.md`](../demos/nostr-recovery.md)
  - [`docs/demos/offline-recovery.md`](../demos/offline-recovery.md)

### Not included / not claimed

- No GitHub release or git tag has been created in this PR.
- No production secrets, OAuth credentials, email provider credentials, or Stripe
  keys are included.
- Nostr and Bitcoin recovery demos are written as reproducible walkthroughs until
  a recorded video URL is available.
- Public alpha is for review/evaluation, not a guarantee of operational custody
  for high-value secrets.

## Release checklist

### Repository readiness

- [x] Public alpha release notes exist in this file.
- [x] Self-hosting guide exists and is linked.
- [x] Product walkthrough outline exists.
- [x] Nostr recovery demo outline exists.
- [x] Offline recovery demo outline exists.
- [x] Cold reviewer quick-start links are in the root README.
- [ ] Maintainer confirms release tag name (`v0.1.0-alpha.1` proposed).
- [ ] Maintainer records or links final demo videos, or accepts markdown
      walkthroughs for alpha.

### Validation before tagging

Run from a clean checkout:

```bash
cd frontend
bun install --frozen-lockfile
bun run check
bun test
bun run build
```

Optional local app smoke test:

```bash
cp frontend/.env.example frontend/.env.local
# adjust DATABASE_URL if using the root docker-compose defaults
make dev
open http://localhost:5173
```

### Suggested tag/release steps after review approval

Do not run these until the draft PR is approved and merged or explicitly chosen
as the release commit.

```bash
git checkout main
git pull --ff-only
git tag -a v0.1.0-alpha.1 -m "KeyFate public alpha v0.1.0-alpha.1"
git push origin v0.1.0-alpha.1
gh release create v0.1.0-alpha.1 \
  --title "KeyFate public alpha v0.1.0-alpha.1" \
  --notes-file docs/release/alpha-0.1.0.md \
  --draft
```

## Cold reviewer path

1. Read the root [`README.md`](../../README.md) for the alpha quick start.
2. Follow [`docs/self-hosting.md`](../self-hosting.md) to configure local or
   hosted dependencies.
3. Run the local app and visit:
   - `/` for public overview,
   - `/sign-up` or `/auth/login` for auth entry points,
   - `/dashboard` after login,
   - `/recover` for browser-only recovery evaluation.
4. Use the demo outlines to evaluate the product story and recovery paths.
5. Review existing specs for deeper architecture context:
   - [`openspec/specs/overview.md`](../../openspec/specs/overview.md)
   - [`openspec/specs/nostr-encrypted-delivery/spec.md`](../../openspec/specs/nostr-encrypted-delivery/spec.md)
   - [`openspec/specs/bitcoin-timelock-delivery/spec.md`](../../openspec/specs/bitcoin-timelock-delivery/spec.md)
   - [`openspec/specs/passphrase-recovery/spec.md`](../../openspec/specs/passphrase-recovery/spec.md)

## Known alpha risks

- The root development Makefile and frontend env examples use different default
  PostgreSQL passwords. Use the exact `DATABASE_URL` from `frontend/.env.example`
  with a matching local database, or update it to match the root `docker-compose`
  password before running migrations.
- Some providers are optional but production-critical: email delivery, OAuth,
  Stripe/BTCPay, cron secret, and public site URL must be configured by the
  operator.
- Recovery flows are designed to run client-side; reviewers should still test on
  non-sensitive sample data only.
