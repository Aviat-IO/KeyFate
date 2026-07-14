# PoC — invalid NIP-59 seal accepted

PoC-Status: executed

The local proof generated valid ephemeral encryption but deliberately replaced the seal's event ID and signature with invalid zero values. It then called the production `unwrapGiftWrap` flow with the recipient key.

The function returned the attacker-controlled recovery share, and the log records:

- `invalidSealSignatureAccepted: true`
- `recoveredAttackerControlledShare: true`

See `evidence/nip59-poc.log`. No public relay or production recipient was used.
