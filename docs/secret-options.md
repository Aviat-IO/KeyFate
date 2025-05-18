# Secret Storage Options

## Hybrid Approach

### Steps

- Encrypt message with new symmetric key (client-side)
- Server encrypts and stores the symmetric key
- Immediately send encrypted message to recipient
- Do NOT store any logs of the encrypted message (only metadata)
- When user fails to check in, the server decrypts and sends the decryption key to the recipient

### Pros of Hybrid

- Server never stores plaintext secrets
- Cannot recover secrets if server is hacked (unless key release logic is also compromised)
- Simple for most users: recipient just needs encrypted message and key

### Cons / Flaws of Hybrid

- If recipient loses the encrypted message, they cannot recover the secret even if they get the key
- If the server is compromised at the moment of key release, attacker could intercept the key
- If the server is malicious, it could release the key early (insider risk)
- Recipient must know how to combine the encrypted message and key (usability issue, but can be solved with a web UI or CLI)
- If the user wants to update or revoke a secret, must ensure old keys/messages are not accessible

## Shamir's Key Sharing

- A 2-of-3 key scheme
- One of the three parties is the server
- The other 2 parties can be
  - Two recipients OR
  - The original sender and one recipient

### Pros of Shamir's

- Server alone cannot decrypt the message
- Even if the server is compromised, attacker cannot reconstruct the secret without another share
- Can support more complex trust models (e.g., multiple recipients, notary, etc.)

### Cons / Flaws of Shamir's

- More complex key management for users and recipients
- If any required share is lost, the secret is unrecoverable
- If the server colludes with one party, they can reconstruct the secret early
- Requires secure delivery and storage of shares to all parties
- If the sender is incapacitated and only the server and recipient have shares, recovery is possible, but if the recipient loses their share, recovery is impossible

## General Considerations

- Both approaches require careful UX to ensure recipients understand how to recover secrets
- Both require secure delivery of keys/shares to recipients (email/SMS is not always secure)
- Both require robust metadata management to avoid accidental disclosure or loss
