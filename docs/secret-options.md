# Secret Storage Options

## Hybrid Approach

### Steps

- Encrypt message with new symmetric key
- Server encrypts and stores the symmetric key
- Immediately send message to recipient
- Do NOT store any logs of the encrypted message (only metadata)
- When user fails to check in, the server decrypts and sends the decryption key to the recipient

### Pros of Hybrid

- Cannot recover secrets if server is hacked

### Cons of Hybrid

- User must know how to combine the original message and decryption key
  - Maybe we give user an interface to upload both (or CLI commands to do it)
- User must maintain original message or recovery is impossible

## Shamir's Key Sharing

- A 2-of-3 key scheme
- One of the three parties is the server
- The other 2 parties can be
  - Two recipients OR
  - The original sender and one recipient

### Pros of Shamir's

- Server alone cannot decrypt the message

### Cons of Shamir's

- Requires trust in the server that the other parts are not stored
