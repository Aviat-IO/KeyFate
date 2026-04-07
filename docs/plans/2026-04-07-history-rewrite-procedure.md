# History Rewrite Procedure

## Purpose

This procedure removes validated secret-bearing files from git history after the
`ENCRYPTION_KEY` rotation. Do not run it casually. It rewrites commit SHAs and
requires force-pushes.

## Validated targets

Remove these paths from history because the audit found real-looking secrets in
committed versions:

- `.env.local`
- `frontend/.env.local`
- `frontend/create-seed-users.js`

Do not include `frontend/.env.staging` in the rewrite set based on the current
audit alone. That file only surfaced a Stripe publishable key, which is not a
secret.

## Preconditions

1. Confirm the replacement `ENCRYPTION_KEY` is already set in Railway staging
   and production.
2. Confirm no one is actively basing work on branches that still reference the
   old history.
3. Install `git-filter-repo` locally.

## Rewrite commands

Run from a fresh clone or a disposable mirror, not from an active working tree:

```bash
git clone --mirror <repo-url> dead-mans-switch-rewrite.git
cd dead-mans-switch-rewrite.git
git filter-repo \
  --invert-paths \
  --path .env.local \
  --path frontend/.env.local \
  --path frontend/create-seed-users.js
```

If you need to preserve `frontend/create-seed-users.js` while only removing the
hardcoded password, stop and use `--replace-text` instead of deleting the whole
file from history.

## Verification after rewrite

Run:

```bash
gitleaks git --redact --no-banner
git log --all -- .env.local frontend/.env.local frontend/create-seed-users.js
```

Expected:

- `gitleaks` no longer reports those historical leaks
- the removed paths no longer appear in rewritten history

## Push procedure

Force-push every rewritten ref deliberately:

```bash
git push --force-with-lease origin <branch-1>
git push --force-with-lease origin <branch-2>
git push --force-with-lease origin <tag-1>
git push --force-with-lease origin <tag-2>
```

Use plain `--force` only if lease-based pushes are impossible and you have
already verified the remote refs have not moved.

If branch protections block force-pushes, use a controlled window:

1. Freeze merges and notify collaborators.
2. Restrict push access to the minimum admin set.
3. Temporarily relax only the protections required for the rewritten refs.
4. Force-push only the intended branches and tags.
5. Re-enable protections immediately.
6. Verify branch protection settings after the push.

## Team cleanup

Every collaborator must back up any unpushed work before refreshing local
history after the rewrite:

```bash
git branch backup/pre-rewrite-$(date +%Y%m%d-%H%M%S)
```

Keep that backup branch local-only. Do not push it. If work must survive the
rewrite, replay it onto rewritten history with `cherry-pick` or by recreating
the branch from the cleaned refs.

Then refresh local history:

```bash
git fetch --all --prune
git checkout main
git reset --hard origin/main
```

Recreate or delete other local branches deliberately after checking whether they
contain unpushed work.

Best option: reclone after the rewrite if you want strong assurance that old
objects are gone.

If a collaborator keeps an existing clone, they should expire reflogs and run
garbage collection after resetting:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

Any stale clones, CI caches, or local mirrors still contain the old objects
until they are deleted or garbage-collected.

## Follow-up

- Re-run CI with the new `.gitleaks.toml`
- Consider rotating any other live secrets that were visibly exposed in Railway
  or local history during the audit process
