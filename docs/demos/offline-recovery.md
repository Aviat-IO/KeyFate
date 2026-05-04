# Offline recovery demo outline

Use this as the alpha offline recovery script until a recorded video URL is
added.

## What this demonstrates

The `/recover` page is designed so recovery operations can be performed in the
browser. A reviewer can load the app, disconnect networking, and recover from
local inputs such as a passphrase bundle or Bitcoin transaction data.

## Preconditions

- Local app or static browser session has loaded `/recover` once.
- Sample recovery inputs only. Do not use real production secrets.
- One of these paths is prepared:
  - **Passphrase path:** encrypted K bundle, encrypted share data, share nonce,
    and passphrase.
  - **Bitcoin path:** pre-signed transaction hex containing an OP_RETURN payload
    with K and Nostr event ID, plus access to the referenced encrypted event if
    needed before going offline.

Relevant references:

- [`openspec/specs/passphrase-recovery/spec.md`](../../openspec/specs/passphrase-recovery/spec.md)
- [`openspec/specs/bitcoin-timelock-delivery/spec.md`](../../openspec/specs/bitcoin-timelock-delivery/spec.md)
- [`frontend/src/routes/recover/+page.svelte`](../../frontend/src/routes/recover/+page.svelte)
- [`frontend/src/lib/components/recovery/PassphraseRecoveryStep.svelte`](../../frontend/src/lib/components/recovery/PassphraseRecoveryStep.svelte)
- [`frontend/src/lib/components/recovery/BitcoinRecoveryStep.svelte`](../../frontend/src/lib/components/recovery/BitcoinRecoveryStep.svelte)

## Passphrase walkthrough

1. Open `/recover` while online or from a local app instance.
2. Disconnect networking.
3. Choose **Passphrase Recovery**.
4. Paste the sample encrypted K bundle, encrypted share, and nonce.
5. Enter the sample passphrase.
6. Decrypt the share.
7. Confirm no KeyFate server request was required after the page loaded.

## Bitcoin/offline walkthrough

1. Open `/recover`.
2. Choose **Bitcoin Recovery**.
3. Paste the sample pre-signed transaction hex.
4. Confirm the OP_RETURN payload is parsed.
5. If the encrypted Nostr event is already available locally/in-page, continue
   offline; otherwise fetch the event before disconnecting.
6. Decrypt the share using the recovered K.

## Reviewer assertions

- [ ] `/recover` loads without authentication.
- [ ] Passphrase recovery can complete after network disconnection when all
      inputs are local.
- [ ] Bitcoin transaction parsing is understandable to a non-project reviewer.
- [ ] Error messages explain missing or malformed input.
- [ ] The demo uses sample data only.

## Recording checklist

- [ ] Show network disabled before entering sensitive-looking demo values.
- [ ] Show no server requests during passphrase recovery after page load.
- [ ] Add final video URL here when available.

Final video URL: _TBD_
