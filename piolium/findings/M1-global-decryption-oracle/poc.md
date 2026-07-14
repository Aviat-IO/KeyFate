# PoC — cross-tenant global decrypt route

PoC-Status: executed

A local Bun test imported the actual `POST` handler and encryption implementation. It:

1. Set an isolated audit encryption key.
2. Encrypted a marker with `encryptMessage`.
3. Invoked `/api/decrypt` with an authenticated session whose user ID was unrelated to the ciphertext.
4. Observed HTTP 200 and the plaintext marker.

The log records `authenticatedAs`, `ciphertextOwner`, `status`, and `crossTenantDecryptSucceeded` without secret key material. See `evidence/decrypt-oracle-poc.log`.

No production keys, accounts, ciphertexts, or databases were used.
