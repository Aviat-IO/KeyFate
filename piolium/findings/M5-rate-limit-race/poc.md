# PoC — rate-limit lost update

PoC-Status: theoretical

Run N parallel requests against an isolated database while the row's count is C. Every request can execute:

```text
SELECT count -> C
check C < limit -> allowed
UPDATE count = C + 1
```

After all N requests complete, the persisted value may be only C+1 even though N requests were authorized. The implementation does not use `count = count + 1`, a lock, a transaction, or a guarded upsert. A database exception also returns `success: true`.

This was not executed against production.
