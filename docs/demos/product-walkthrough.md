# Product walkthrough outline

Use this as the alpha demo script until a recorded video URL is added.

## Audience

Funders, external reviewers, and technically capable users evaluating whether
KeyFate is understandable and runnable without private context.

## Demo setup

- Local app running at <http://localhost:5173> or a staging URL.
- Test account only.
- Sample secret only, for example: `alpha-demo-secret-do-not-use`.
- Browser devtools network tab optional to show recovery pages are static/client
  side where applicable.

## Walkthrough

1. **Landing page**
   - Open `/`.
   - Explain KeyFate as a zero-knowledge dead man's switch.
   - Point out target users: crypto holders, estate planning, journalists.

2. **Account entry**
   - Open `/sign-up` or `/auth/login`.
   - Explain available auth mode depends on operator configuration.
   - Sign in with a test account.

3. **Dashboard**
   - Open `/dashboard`.
   - Show where secrets/check-ins are managed.
   - Explain that production readiness depends on email, cron, and provider
     configuration from [`docs/self-hosting.md`](../self-hosting.md).

4. **Secret and recovery model**
   - Explain that secret handling is designed around client-side encryption and
     Shamir share recovery.
   - Show public architecture/spec links from
     [`docs/release/alpha-0.1.0.md`](../release/alpha-0.1.0.md).

5. **Recovery page**
   - Open `/recover`.
   - Show method selector: Nostr, Bitcoin transaction, passphrase.
   - Explain all recovery methods are intended to execute in the browser.

6. **Alpha caveats**
   - No real funds or production secrets in alpha.
   - Release tag is proposed, not cut by the docs PR.
   - Demo video can be recorded directly from this script.

## Recording checklist

- [ ] Show repository URL and commit hash.
- [ ] Show local run command or staging URL.
- [ ] Show `/`, auth entry, `/dashboard`, and `/recover`.
- [ ] State clearly what is alpha-ready and what still needs operator setup.
- [ ] Add final video URL here when available.

Final video URL: _TBD_
