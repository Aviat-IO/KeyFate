# ESLint baseline

`eslint-suppressions.json` records the pre-existing ESLint violations at audited commit
`b7b7aef1a897c418e0402acd211fecf0206d8217`. ESLint's count-based bulk suppression keeps
those known violations visible as debt while causing any new violation to fail `bun run lint`.

When a legacy violation is fixed, prune its stale entry and format the result:

```bash
bunx eslint . --prune-suppressions
bunx prettier --write eslint-suppressions.json
```

Do not regenerate the baseline from the current tree merely to make CI pass.
