# Nostr recovery demo outline

Use this as the alpha Nostr recovery script until a recorded video URL is added.

## What this demonstrates

KeyFate's Nostr recovery path lets a recipient find encrypted gift-wrapped share
events on Nostr relays and decrypt them in the browser with recipient-held
material. The alpha reviewer should evaluate the flow shape and client-side
boundary, not use real secrets.

## Preconditions

- KeyFate app loaded at `/recover`.
- Test recipient Nostr `nsec`; never use a real identity key for alpha demos.
- Test encrypted share event available on configured relays, or fixture data from
  the Nostr delivery tests/specs.
- Sample K recovery material via passphrase or Bitcoin OP_RETURN path, depending
  on the event being demonstrated.

Relevant references:

- [`docs/NOSTR_INTEGRATION.md`](../NOSTR_INTEGRATION.md)
- [`openspec/specs/nostr-encrypted-delivery/spec.md`](../../openspec/specs/nostr-encrypted-delivery/spec.md)
- [`frontend/src/lib/components/recovery/NostrRecoveryStep.svelte`](../../frontend/src/lib/components/recovery/NostrRecoveryStep.svelte)

## Walkthrough

1. Open `/recover`.
2. Choose **Nostr Recovery**.
3. Enter the test recipient `nsec`.
4. Search configured relays for gift-wrapped events.
5. Select a test event.
6. Choose the K recovery method required by that event.
7. Decrypt the share in the browser.
8. Copy or carry the recovered share to the final reconstruction step.

## Reviewer assertions

- [ ] The page is reachable without signing in.
- [ ] Private key entry stays in the browser and is not posted to KeyFate server
      endpoints.
- [ ] Relay search is explicit and understandable.
- [ ] Failure states are clear when no relay event is found.
- [ ] Successful output identifies the recovered share and next step.

## Recording checklist

- [ ] Use a disposable `nsec`.
- [ ] Use non-sensitive fixture/sample data.
- [ ] Show the network panel if validating browser/server boundary.
- [ ] Add final video URL here when available.

Final video URL: _TBD_
