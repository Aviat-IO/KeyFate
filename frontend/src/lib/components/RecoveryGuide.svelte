<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import { AlertCircle, Bitcoin, Key, Lock, Shield, Wifi } from '@lucide/svelte';

  let {
    class: className
  }: {
    class?: string;
  } = $props();
</script>

<div class={className}>
  <Card.Root class="border-0 shadow-none bg-transparent">
    <Card.Header>
      <Card.Title class="font-space flex items-center gap-2">
        <Shield class="h-5 w-5" />
        Recovery Guide
      </Card.Title>
      <Card.Description>
        How to recover a secret using your recovery kit — even if KeyFate is unreachable.
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-6">
      <!-- What the kit contains -->
      <div>
        <h3 class="font-space mb-2 text-sm font-semibold">What your recovery kit contains</h3>
        <ul class="text-muted-foreground space-y-1 text-sm">
          <li>&bull; <strong>Server share</strong> — the decrypted Shamir share held by KeyFate</li>
          <li>&bull; <strong>User-managed shares</strong> — shares stored in your browser (if available)</li>
          <li>&bull; <strong>Bitcoin data</strong> — pre-signed transaction, UTXO details, timelock info</li>
          <li>&bull; <strong>Nostr data</strong> — relay list and encrypted key passphrase bundle</li>
          <li>&bull; <strong>Recovery instructions</strong> — how to reconstruct the secret offline</li>
        </ul>
      </div>

      <Separator />

      <!-- Recovery methods -->
      <div>
        <h3 class="font-space mb-3 text-sm font-semibold">Recovery Methods</h3>
        <p class="text-muted-foreground mb-4 text-sm">
          Your secret is protected by double encryption. First, collect enough Shamir shares
          (threshold). Then, recover the symmetric key K using one of three independent paths:
        </p>

        <Accordion.Root type="single" class="w-full">
          <!-- Method 1: Bitcoin OP_RETURN -->
          <Accordion.Item value="bitcoin">
            <Accordion.Trigger class="text-sm">
              <span class="flex items-center gap-2">
                <Bitcoin class="h-4 w-4" />
                Path 1: Bitcoin OP_RETURN
                <Badge variant="default" class="ml-2 text-xs">Trustless</Badge>
                <Badge variant="secondary" class="text-xs">Quantum-safe</Badge>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <div class="space-y-3 pb-2 text-sm">
                <p class="text-muted-foreground">
                  The symmetric key K is embedded in a Bitcoin transaction's OP_RETURN output.
                  After the CSV timelock expires (owner missed check-in), the pre-signed
                  transaction becomes valid and can be broadcast.
                </p>
                <ol class="text-muted-foreground list-inside list-decimal space-y-2">
                  <li>
                    Wait for the CSV timelock to expire (check the <code class="bg-muted rounded px-1">timelockDays</code> field
                    in your recovery kit).
                  </li>
                  <li>
                    Broadcast the <code class="bg-muted rounded px-1">preSignedRecipientTx</code> hex using any Bitcoin
                    node or service (e.g., mempool.space/tx/push).
                  </li>
                  <li>
                    Once confirmed, find the OP_RETURN output in the transaction. The first 32
                    bytes are the symmetric key K.
                  </li>
                  <li>
                    Use K to decrypt each share with ChaCha20-Poly1305 (the nonce is stored
                    alongside the encrypted share).
                  </li>
                  <li>
                    Combine the decrypted Shamir shares (threshold count) to reconstruct the
                    original secret.
                  </li>
                </ol>
                <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div class="flex gap-2">
                    <AlertCircle class="h-4 w-4 shrink-0 text-destructive" />
                    <p class="text-xs text-muted-foreground">
                      This path requires no trust in any third party. The Bitcoin network
                      enforces the timelock. K is revealed on-chain only after the owner
                      fails to check in.
                    </p>
                  </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <!-- Method 2: Nostr NIP-44 -->
          <Accordion.Item value="nostr">
            <Accordion.Trigger class="text-sm">
              <span class="flex items-center gap-2">
                <Wifi class="h-4 w-4" />
                Path 2: Nostr (NIP-44 Decryption)
                <Badge variant="secondary" class="ml-2 text-xs">Convenient</Badge>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <div class="space-y-3 pb-2 text-sm">
                <p class="text-muted-foreground">
                  K was encrypted using NIP-44 (ECDH + ChaCha20) with the owner's private key
                  and your public key. If you have your Nostr private key, you can decrypt K
                  directly.
                </p>
                <ol class="text-muted-foreground list-inside list-decimal space-y-2">
                  <li>
                    Query the Nostr relays listed in your recovery kit for gift-wrapped events
                    (kind 1059) tagged with your public key.
                  </li>
                  <li>
                    Unwrap the gift wrap: decrypt with your private key to get the seal (kind 13),
                    then decrypt the seal to get the rumor (kind 21059).
                  </li>
                  <li>
                    The rumor content contains the encrypted share and the NIP-44 encrypted K.
                  </li>
                  <li>
                    Derive the conversation key using your private key and the sender's public key,
                    then decrypt K.
                  </li>
                  <li>
                    Use K to decrypt the share, then combine shares to reconstruct the secret.
                  </li>
                </ol>
                <div class="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div class="flex gap-2">
                    <AlertCircle class="h-4 w-4 shrink-0 text-destructive" />
                    <p class="text-xs text-muted-foreground">
                      This path relies on elliptic curve cryptography (secp256k1) which is
                      <strong>not quantum-safe</strong>. Use the passphrase or Bitcoin path
                      for long-term security.
                    </p>
                  </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <!-- Method 3: Passphrase -->
          <Accordion.Item value="passphrase">
            <Accordion.Trigger class="text-sm">
              <span class="flex items-center gap-2">
                <Key class="h-4 w-4" />
                Path 3: Passphrase
                <Badge variant="default" class="ml-2 text-xs">Offline</Badge>
                <Badge variant="secondary" class="text-xs">Quantum-safe</Badge>
              </span>
            </Accordion.Trigger>
            <Accordion.Content>
              <div class="space-y-3 pb-2 text-sm">
                <p class="text-muted-foreground">
                  K was encrypted with a passphrase using PBKDF2-SHA256 (600,000 iterations)
                  + AES-256-GCM. If you know the passphrase, you can recover K without any
                  network access.
                </p>
                <ol class="text-muted-foreground list-inside list-decimal space-y-2">
                  <li>
                    Locate the <code class="bg-muted rounded px-1">encryptedKPassphrase</code> field in your recovery
                    kit's Nostr section. It contains <code class="bg-muted rounded px-1">ciphertext</code>,
                    <code class="bg-muted rounded px-1">nonce</code>, and <code class="bg-muted rounded px-1">salt</code> (all hex-encoded).
                  </li>
                  <li>
                    Re-derive the AES key from the passphrase using PBKDF2-SHA256 with the
                    stored salt (600,000 iterations).
                  </li>
                  <li>
                    Decrypt the ciphertext with AES-256-GCM using the derived key and stored
                    nonce. The result is the 32-byte symmetric key K.
                  </li>
                  <li>
                    Use K to decrypt each share with ChaCha20-Poly1305.
                  </li>
                  <li>
                    Combine the decrypted Shamir shares to reconstruct the secret.
                  </li>
                </ol>
                <div class="rounded-lg border border-primary/50 bg-primary/10 p-3">
                  <div class="flex gap-2">
                    <Lock class="h-4 w-4 shrink-0 text-primary" />
                    <p class="text-xs text-muted-foreground">
                      This path uses only symmetric cryptography (PBKDF2 + AES-256-GCM +
                      ChaCha20-Poly1305). It is fully quantum-safe and works completely
                      offline.
                    </p>
                  </div>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>

      <Separator />

      <!-- If KeyFate is unreachable -->
      <div>
        <h3 class="font-space mb-2 text-sm font-semibold">If KeyFate is unreachable</h3>
        <div class="text-muted-foreground space-y-2 text-sm">
          <p>
            Your recovery kit is designed to work without KeyFate. Here's what to do:
          </p>
          <ol class="list-inside list-decimal space-y-1">
            <li>
              <strong>Gather shares:</strong> You need at least the threshold number of
              Shamir shares. Check your recovery kit for the server share and any
              user-managed shares.
            </li>
            <li>
              <strong>Recover K:</strong> Use any of the three paths above (Bitcoin,
              Nostr, or Passphrase) to obtain the symmetric key K.
            </li>
            <li>
              <strong>Decrypt shares:</strong> Each share is encrypted with ChaCha20-Poly1305
              using K. Decrypt each one using the nonce stored alongside it.
            </li>
            <li>
              <strong>Reconstruct:</strong> Use a Shamir Secret Sharing library to combine
              the decrypted shares. Any implementation of GF(256) Shamir will work.
            </li>
          </ol>
          <p class="mt-2 text-xs italic">
            Tools: You can use the open-source <code class="bg-muted rounded px-1">shamirs-secret-sharing</code> npm
            package, or any compatible implementation. The recovery kit JSON format is
            documented and stable.
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</div>
