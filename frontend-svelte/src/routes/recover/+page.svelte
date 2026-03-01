<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import * as Alert from '$lib/components/ui/alert';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';
  import {
    Loader2,
    Shield,
    Search,
    Bitcoin,
    KeyRound,
    Lock,
    CheckCircle,
    AlertTriangle,
    Copy,
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
  } from '@lucide/svelte';
  import {
    isValidNsec,
    nsecToSecretKey,
    unwrapGiftWrap,
    parseOpReturnFromTx,
    parseEncryptedKBundle,
    recoverKWithPassphrase,
    decryptShareWithK,
    hexToBytes,
    bytesToHex,
    type FoundGiftWrap,
    type UnwrappedShare,
    type DecryptedShareResult,
  } from '$lib/crypto/recovery-flows';
  import { createNostrClient } from '$lib/nostr/client';
  import { publicKeyFromSecret } from '$lib/nostr/keypair';
  import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
  import { recoverKFromOpReturn, decryptShare } from '$lib/crypto/recovery';

  // ─── State ───────────────────────────────────────────────────────────────

  type RecoveryMethod = 'nostr' | 'bitcoin' | 'passphrase';
  type Step = 'choose' | 'recover' | 'result';

  let currentStep = $state<Step>('choose');
  let selectedMethod = $state<RecoveryMethod | null>(null);

  // Nostr recovery state
  let nsecInput = $state('');
  let nsecVisible = $state(false);
  let searchingRelays = $state(false);
  let foundEvents = $state<FoundGiftWrap[]>([]);
  let selectedEventIndices = $state<Set<number>>(new Set());
  let unwrappedShares = $state<UnwrappedShare[]>([]);
  let unwrapping = $state(false);

  // K recovery sub-state (used after Nostr unwrap)
  let kRecoveryMethod = $state<'passphrase' | 'opreturn' | null>(null);
  let kPassphrase = $state('');
  let kBundleJson = $state('');
  let kOpReturnHex = $state('');
  let encryptedShareHex = $state('');
  let nonceHex = $state('');
  let recoveringK = $state(false);

  // Bitcoin recovery state
  let txHexInput = $state('');
  let parsingTx = $state(false);
  let parsedOpReturn = $state<{ symmetricKeyK: Uint8Array; nostrEventId: string } | null>(null);
  let fetchingNostrEvent = $state(false);

  // Passphrase recovery state
  let passphraseInput = $state('');
  let bundleJsonInput = $state('');
  let shareDataInput = $state('');
  let shareNonceInput = $state('');
  let recoveringPassphrase = $state(false);

  // Results
  let decryptedShares = $state<DecryptedShareResult[]>([]);
  let error = $state<string | null>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────

  let nsecValid = $derived(nsecInput.trim().length > 0 && isValidNsec(nsecInput.trim()));
  let canSearchRelays = $derived(nsecValid && !searchingRelays);
  let hasSelectedEvents = $derived(selectedEventIndices.size > 0);

  // ─── Methods ─────────────────────────────────────────────────────────────

  function selectMethod(method: RecoveryMethod) {
    selectedMethod = method;
    currentStep = 'recover';
    error = null;
  }

  function goBack() {
    if (currentStep === 'result') {
      currentStep = 'recover';
      decryptedShares = [];
    } else if (currentStep === 'recover') {
      currentStep = 'choose';
      selectedMethod = null;
      resetState();
    }
  }

  function resetState() {
    nsecInput = '';
    nsecVisible = false;
    foundEvents = [];
    selectedEventIndices = new Set();
    unwrappedShares = [];
    kRecoveryMethod = null;
    kPassphrase = '';
    kBundleJson = '';
    kOpReturnHex = '';
    encryptedShareHex = '';
    nonceHex = '';
    txHexInput = '';
    parsedOpReturn = null;
    passphraseInput = '';
    bundleJsonInput = '';
    shareDataInput = '';
    shareNonceInput = '';
    decryptedShares = [];
    error = null;
  }

  function toggleEventSelection(index: number) {
    const next = new Set(selectedEventIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    selectedEventIndices = next;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }

  // ─── Nostr Recovery Flow ─────────────────────────────────────────────────

  async function searchRelays() {
    if (!nsecValid) return;
    error = null;
    searchingRelays = true;
    foundEvents = [];
    selectedEventIndices = new Set();

    try {
      const secretKey = nsecToSecretKey(nsecInput.trim());
      const pubkey = publicKeyFromSecret(secretKey);

      const client = createNostrClient({ relays: [...DEFAULT_RELAYS] });

      try {
        const events = await client.query({
          kinds: [1059],
          '#p': [pubkey],
        });

        foundEvents = events.map((event) => ({
          event,
          createdAt: event.created_at,
          senderPubkey: event.pubkey,
        }));

        if (foundEvents.length === 0) {
          toast.info('No gift-wrapped events found for this key');
        } else {
          toast.success(`Found ${foundEvents.length} event(s)`);
        }
      } finally {
        client.close();
      }
    } catch (e) {
      error = `Relay search failed: ${e instanceof Error ? e.message : String(e)}`;
      toast.error('Relay search failed');
    } finally {
      searchingRelays = false;
    }
  }

  async function unwrapSelectedEvents() {
    if (!hasSelectedEvents || !nsecValid) return;
    error = null;
    unwrapping = true;
    unwrappedShares = [];

    try {
      const secretKey = nsecToSecretKey(nsecInput.trim());
      const shares: UnwrappedShare[] = [];

      for (const idx of selectedEventIndices) {
        const gw = foundEvents[idx];
        try {
          const share = unwrapGiftWrap(gw.event, secretKey);
          shares.push(share);
        } catch (e) {
          toast.error(
            `Failed to unwrap event ${idx + 1}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      unwrappedShares = shares;

      if (shares.length > 0) {
        toast.success(`Unwrapped ${shares.length} share(s)`);
      }
    } catch (e) {
      error = `Unwrap failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      unwrapping = false;
    }
  }

  async function decryptSharesWithK() {
    if (!kRecoveryMethod) return;
    error = null;
    recoveringK = true;

    try {
      let K: Uint8Array;

      if (kRecoveryMethod === 'passphrase') {
        if (!kPassphrase || !kBundleJson) {
          throw new Error('Passphrase and encrypted K bundle are required');
        }
        const bundle = parseEncryptedKBundle(kBundleJson);
        K = await recoverKWithPassphrase(kPassphrase, bundle);
      } else {
        // opreturn
        if (!kOpReturnHex) {
          throw new Error('OP_RETURN hex data is required');
        }
        const opReturnBytes = hexToBytes(kOpReturnHex.trim());
        K = recoverKFromOpReturn(opReturnBytes);
      }

      // Decrypt each unwrapped share
      const results: DecryptedShareResult[] = [];
      for (const share of unwrappedShares) {
        try {
          const encShare = hexToBytes(share.share);
          // The share data from the rumor contains the encrypted share
          // We need the nonce too - it should be embedded in the share payload
          // For now, try to decrypt directly
          const plaintext = decryptShare(encShare, hexToBytes(nonceHex), K);
          results.push({
            share: plaintext,
            shareIndex: share.shareIndex,
            threshold: share.threshold,
            totalShares: share.totalShares,
            secretId: share.secretId,
          });
        } catch (e) {
          toast.error(
            `Failed to decrypt share ${share.shareIndex}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (results.length > 0) {
        decryptedShares = results;
        currentStep = 'result';
        toast.success(`Decrypted ${results.length} share(s)`);
      }
    } catch (e) {
      error = `K recovery failed: ${e instanceof Error ? e.message : String(e)}`;
      toast.error('Failed to recover symmetric key');
    } finally {
      recoveringK = false;
    }
  }

  // ─── Bitcoin Recovery Flow ───────────────────────────────────────────────

  async function parseBitcoinTx() {
    error = null;
    parsingTx = true;
    parsedOpReturn = null;

    try {
      const result = parseOpReturnFromTx(txHexInput.trim());
      parsedOpReturn = result;
      toast.success('OP_RETURN data extracted successfully');
    } catch (e) {
      error = `Transaction parsing failed: ${e instanceof Error ? e.message : String(e)}`;
      toast.error('Failed to parse transaction');
    } finally {
      parsingTx = false;
    }
  }

  async function fetchAndDecryptFromBitcoin() {
    if (!parsedOpReturn) return;
    error = null;
    fetchingNostrEvent = true;

    try {
      const { symmetricKeyK, nostrEventId } = parsedOpReturn;

      // Fetch the encrypted share from Nostr using the event ID
      const client = createNostrClient({ relays: [...DEFAULT_RELAYS] });

      try {
        const event = await client.get({
          ids: [nostrEventId],
        });

        if (!event) {
          throw new Error(
            `Nostr event ${nostrEventId.slice(0, 16)}... not found on any relay`,
          );
        }

        // The event content should contain the encrypted share data
        // Parse it and decrypt with K
        const payload = JSON.parse(event.content);
        const encShare = hexToBytes(payload.encryptedShare);
        const nonce = hexToBytes(payload.nonce);

        const plaintext = decryptShare(encShare, nonce, symmetricKeyK);

        decryptedShares = [
          {
            share: plaintext,
            shareIndex: payload.shareIndex ?? 1,
            threshold: payload.threshold ?? 0,
            totalShares: payload.totalShares ?? 0,
            secretId: payload.secretId ?? 'unknown',
          },
        ];
        currentStep = 'result';
        toast.success('Share decrypted successfully');
      } finally {
        client.close();
      }
    } catch (e) {
      error = `Recovery failed: ${e instanceof Error ? e.message : String(e)}`;
      toast.error('Failed to fetch or decrypt share');
    } finally {
      fetchingNostrEvent = false;
    }
  }

  // ─── Passphrase Recovery Flow ────────────────────────────────────────────

  async function recoverWithPassphrase() {
    error = null;
    recoveringPassphrase = true;

    try {
      if (!passphraseInput) throw new Error('Passphrase is required');
      if (!bundleJsonInput) throw new Error('Encrypted K bundle is required');
      if (!shareDataInput) throw new Error('Encrypted share data is required');
      if (!shareNonceInput) throw new Error('Share nonce is required');

      const bundle = parseEncryptedKBundle(bundleJsonInput);
      const K = await recoverKWithPassphrase(passphraseInput, bundle);

      const encShare = hexToBytes(shareDataInput.trim());
      const nonce = hexToBytes(shareNonceInput.trim());
      const plaintext = decryptShare(encShare, nonce, K);

      decryptedShares = [
        {
          share: plaintext,
          shareIndex: 0,
          threshold: 0,
          totalShares: 0,
          secretId: 'manual',
        },
      ];
      currentStep = 'result';
      toast.success('Share decrypted successfully');
    } catch (e) {
      error = `Passphrase recovery failed: ${e instanceof Error ? e.message : String(e)}`;
      toast.error('Failed to recover with passphrase');
    } finally {
      recoveringPassphrase = false;
    }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  function truncateHex(hex: string, len = 16): string {
    if (hex.length <= len * 2) return hex;
    return `${hex.slice(0, len)}...${hex.slice(-len)}`;
  }
</script>

<svelte:head>
  <title>Recover Shares - KeyFate</title>
  <meta
    name="description"
    content="Recover your encrypted shares using Nostr, Bitcoin, or a passphrase."
  />
</svelte:head>

<div class="bg-background min-h-screen">
  <div class="mx-auto max-w-3xl px-6 py-12">
    <!-- Header -->
    <div class="mb-12">
      <h1 class="font-space text-3xl font-light tracking-tight">Recover Your Shares</h1>
      <p class="text-muted-foreground mt-2 text-sm">
        Decrypt your secret shares using one of three recovery methods.
        This page works entirely in your browser — no data is sent to any server.
      </p>
    </div>

    <!-- Back button -->
    {#if currentStep !== 'choose'}
      <Button variant="ghost" onclick={goBack} class="mb-4">
        <ArrowLeft class="mr-2 h-4 w-4" />
        Back
      </Button>
    {/if}

    <!-- Error display -->
    {#if error}
      <Alert.Alert variant="destructive" class="mb-6">
        <AlertTriangle class="h-4 w-4" />
        <Alert.AlertTitle>Error</Alert.AlertTitle>
        <Alert.AlertDescription>{error}</Alert.AlertDescription>
      </Alert.Alert>
    {/if}

    <!-- Step 1: Choose recovery method -->
    {#if currentStep === 'choose'}
      <div class="grid gap-6 sm:grid-cols-3">
        <button
          type="button"
          onclick={() => selectMethod('nostr')}
          class="group text-left"
        >
          <div class="space-y-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <Search class="text-primary h-5 w-5" />
            <h3 class="font-space text-lg font-bold tracking-tight">Recover via Nostr</h3>
            <p class="text-muted-foreground text-sm">
              Search Nostr relays for gift-wrapped events using your nsec key.
            </p>
            <p class="text-muted-foreground text-xs">
              Requires your Nostr private key (nsec). Events are decrypted locally.
            </p>
          </div>
        </button>

        <button
          type="button"
          onclick={() => selectMethod('bitcoin')}
          class="group text-left"
        >
          <div class="space-y-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <Bitcoin class="text-primary h-5 w-5" />
            <h3 class="font-space text-lg font-bold tracking-tight">Recover via Bitcoin</h3>
            <p class="text-muted-foreground text-sm">
              Extract the symmetric key from a pre-signed Bitcoin transaction.
            </p>
            <p class="text-muted-foreground text-xs">
              Requires the pre-signed transaction hex from your recovery kit.
            </p>
          </div>
        </button>

        <button
          type="button"
          onclick={() => selectMethod('passphrase')}
          class="group text-left"
        >
          <div class="space-y-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
            <KeyRound class="text-primary h-5 w-5" />
            <h3 class="font-space text-lg font-bold tracking-tight">Recover via Passphrase</h3>
            <p class="text-muted-foreground text-sm">
              Use a passphrase to derive the decryption key from your recovery kit.
            </p>
            <p class="text-muted-foreground text-xs">
              Requires the passphrase and encrypted key bundle from your recovery kit.
            </p>
          </div>
        </button>
      </div>

      <Alert.Alert class="mt-6">
        <Lock class="h-4 w-4" />
        <Alert.AlertTitle>Security Notice</Alert.AlertTitle>
        <Alert.AlertDescription>
          All decryption happens locally in your browser. Your private keys and passphrases
          are never transmitted. For maximum security, use this page offline after loading it.
        </Alert.AlertDescription>
      </Alert.Alert>
    {/if}

    <!-- Step 2a: Nostr Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'nostr'}
      <div class="space-y-6">
        <div>
          <h2 class="font-space text-xl font-bold tracking-tight">Recover via Nostr</h2>
          <p class="text-muted-foreground mt-1 text-sm">
            Enter your Nostr private key to search for gift-wrapped share events.
          </p>
        </div>

        <!-- nsec input -->
        <div class="space-y-2">
          <Label for="nsec-input">Nostr Private Key (nsec)</Label>
          <Alert.Alert variant="destructive" class="mb-2">
            <AlertTriangle class="h-4 w-4" />
            <Alert.AlertDescription class="text-xs">
              Your nsec is your Nostr identity. Never share it. It is only used locally
              to decrypt events and is never sent anywhere.
            </Alert.AlertDescription>
          </Alert.Alert>
          <div class="relative">
            <Textarea
              id="nsec-input"
              placeholder="nsec1..."
              bind:value={nsecInput}
              class="font-mono text-sm pr-10"
              rows={2}
              autocomplete="off"
              spellcheck={false}
              style={nsecVisible ? '' : '-webkit-text-security: disc; text-security: disc;'}
            />
            <Button
              variant="ghost"
              size="sm"
              class="absolute right-1 top-1 h-8 w-8 p-0"
              onclick={() => (nsecVisible = !nsecVisible)}
              aria-label={nsecVisible ? 'Hide private key' : 'Show private key'}
            >
              {#if nsecVisible}
                <EyeOff class="h-4 w-4" />
              {:else}
                <Eye class="h-4 w-4" />
              {/if}
            </Button>
          </div>
          {#if nsecInput.trim() && !nsecValid}
            <p class="text-destructive text-xs">Invalid nsec format</p>
          {/if}
        </div>

        <!-- Search button -->
        <Button onclick={searchRelays} disabled={!canSearchRelays} class="w-full">
          {#if searchingRelays}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Searching relays...
          {:else}
            <Search class="mr-2 h-4 w-4" />
            Search Relays
          {/if}
        </Button>

        <!-- Found events -->
        {#if foundEvents.length > 0}
          <Separator />
          <div class="space-y-3">
            <h3 class="font-space text-sm font-medium">
              Found {foundEvents.length} event{foundEvents.length !== 1 ? 's' : ''}
            </h3>
            <div class="space-y-2">
              {#each foundEvents as gw, i}
                <button
                  type="button"
                  onclick={() => toggleEventSelection(i)}
                  class="border-border hover:bg-accent w-full rounded-lg border p-3 text-left transition-colors {selectedEventIndices.has(i) ? 'bg-accent border-primary' : ''}"
                >
                  <div class="flex items-center justify-between">
                    <div class="space-y-1">
                      <p class="text-xs font-medium">
                        Event {i + 1}
                      </p>
                      <p class="text-muted-foreground font-mono text-xs">
                        From: {truncateHex(gw.senderPubkey)}
                      </p>
                      <p class="text-muted-foreground text-xs">
                        {formatTimestamp(gw.createdAt)}
                      </p>
                    </div>
                    <div class="flex h-5 w-5 items-center justify-center rounded border {selectedEventIndices.has(i) ? 'bg-primary border-primary' : 'border-muted-foreground'}">
                      {#if selectedEventIndices.has(i)}
                        <CheckCircle class="text-primary-foreground h-3 w-3" />
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>

            <Button
              onclick={unwrapSelectedEvents}
              disabled={!hasSelectedEvents || unwrapping}
              class="w-full"
            >
              {#if unwrapping}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                Unwrapping...
              {:else}
                Unwrap Selected Events ({selectedEventIndices.size})
              {/if}
            </Button>
          </div>
        {/if}

        <!-- Unwrapped shares - need K to decrypt -->
        {#if unwrappedShares.length > 0}
          <Separator />
          <div class="space-y-4">
            <h3 class="font-space text-sm font-medium">
              Unwrapped {unwrappedShares.length} share{unwrappedShares.length !== 1 ? 's' : ''}
            </h3>
            <p class="text-muted-foreground text-xs">
              Shares are still encrypted with the symmetric key K.
              Choose how to recover K:
            </p>

            <div class="grid gap-2 sm:grid-cols-2">
              <Button
                variant={kRecoveryMethod === 'passphrase' ? 'default' : 'outline'}
                onclick={() => (kRecoveryMethod = 'passphrase')}
              >
                <KeyRound class="mr-2 h-4 w-4" />
                Via Passphrase
              </Button>
              <Button
                variant={kRecoveryMethod === 'opreturn' ? 'default' : 'outline'}
                onclick={() => (kRecoveryMethod = 'opreturn')}
              >
                <Bitcoin class="mr-2 h-4 w-4" />
                Via OP_RETURN
              </Button>
            </div>

            {#if kRecoveryMethod === 'passphrase'}
              <div class="space-y-3">
                <div class="space-y-2">
                  <Label for="k-passphrase">Passphrase</Label>
                  <Input
                    id="k-passphrase"
                    type="password"
                    bind:value={kPassphrase}
                    placeholder="Enter your recovery passphrase"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="k-bundle">Encrypted K Bundle (JSON)</Label>
                  <Textarea
                    id="k-bundle"
                    bind:value={kBundleJson}
                    placeholder={'{"ciphertext":"...","nonce":"...","salt":"..."}'}
                    class="font-mono text-xs"
                    rows={3}
                  />
                </div>
                <div class="space-y-2">
                  <Label for="share-nonce">Share Nonce (hex)</Label>
                  <Input
                    id="share-nonce"
                    bind:value={nonceHex}
                    placeholder="12-byte nonce in hex (24 chars)"
                    class="font-mono text-xs"
                  />
                </div>
              </div>
            {/if}

            {#if kRecoveryMethod === 'opreturn'}
              <div class="space-y-3">
                <div class="space-y-2">
                  <Label for="k-opreturn">OP_RETURN Data (hex, 32 bytes)</Label>
                  <Input
                    id="k-opreturn"
                    bind:value={kOpReturnHex}
                    placeholder="64 hex characters (32 bytes)"
                    class="font-mono text-xs"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="share-nonce-op">Share Nonce (hex)</Label>
                  <Input
                    id="share-nonce-op"
                    bind:value={nonceHex}
                    placeholder="12-byte nonce in hex (24 chars)"
                    class="font-mono text-xs"
                  />
                </div>
              </div>
            {/if}

            {#if kRecoveryMethod}
              <Button
                onclick={decryptSharesWithK}
                disabled={recoveringK}
                class="w-full"
              >
                {#if recoveringK}
                  <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                  Recovering key...
                {:else}
                  <ArrowRight class="mr-2 h-4 w-4" />
                  Decrypt Shares
                {/if}
              </Button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Step 2b: Bitcoin Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'bitcoin'}
      <div class="space-y-6">
        <div>
          <h2 class="font-space text-xl font-bold tracking-tight">Recover via Bitcoin</h2>
          <p class="text-muted-foreground mt-1 text-sm">
            Paste the pre-signed transaction hex to extract the symmetric key and Nostr event pointer.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="tx-hex">Transaction Hex</Label>
          <Textarea
            id="tx-hex"
            bind:value={txHexInput}
            placeholder="Paste the raw transaction hex from your recovery kit..."
            class="font-mono text-xs"
            rows={4}
            spellcheck={false}
          />
        </div>

        <Button
          onclick={parseBitcoinTx}
          disabled={!txHexInput.trim() || parsingTx}
          class="w-full"
        >
          {#if parsingTx}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Parsing transaction...
          {:else}
            <Bitcoin class="mr-2 h-4 w-4" />
            Parse Transaction
          {/if}
        </Button>

        {#if parsedOpReturn}
          <Separator />
          <div class="space-y-3">
            <h3 class="font-space text-sm font-medium">Extracted OP_RETURN Data</h3>
            <div class="bg-muted space-y-2 rounded-lg p-3">
              <div>
                <p class="text-xs text-muted-foregroundr font-medium">Symmetric Key K</p>
                <p class="font-mono text-xs break-all">
                  {bytesToHex(parsedOpReturn.symmetricKeyK)}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foregroundr font-medium">Nostr Event ID</p>
                <p class="font-mono text-xs break-all">
                  {parsedOpReturn.nostrEventId}
                </p>
              </div>
            </div>

            <Button
              onclick={fetchAndDecryptFromBitcoin}
              disabled={fetchingNostrEvent}
              class="w-full"
            >
              {#if fetchingNostrEvent}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                Fetching from Nostr...
              {:else}
                <ArrowRight class="mr-2 h-4 w-4" />
                Fetch & Decrypt Share
              {/if}
            </Button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Step 2c: Passphrase Recovery -->
    {#if currentStep === 'recover' && selectedMethod === 'passphrase'}
      <div class="space-y-6">
        <div>
          <h2 class="font-space text-xl font-bold tracking-tight">Recover via Passphrase</h2>
          <p class="text-muted-foreground mt-1 text-sm">
            Enter your passphrase and the encrypted data from your recovery kit.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="passphrase">Passphrase</Label>
          <Input
            id="passphrase"
            type="password"
            bind:value={passphraseInput}
            placeholder="Enter your recovery passphrase"
          />
        </div>

        <div class="space-y-2">
          <Label for="bundle-json">Encrypted K Bundle (JSON)</Label>
          <Textarea
            id="bundle-json"
            bind:value={bundleJsonInput}
            placeholder={'{"ciphertext":"...","nonce":"...","salt":"..."}'}
            class="font-mono text-xs"
            rows={3}
            spellcheck={false}
          />
          <p class="text-muted-foreground text-xs">
            From your recovery kit — contains the encrypted symmetric key.
          </p>
        </div>

        <Separator />

        <div class="space-y-2">
          <Label for="share-data">Encrypted Share (hex)</Label>
          <Textarea
            id="share-data"
            bind:value={shareDataInput}
            placeholder="Hex-encoded encrypted share data"
            class="font-mono text-xs"
            rows={3}
            spellcheck={false}
          />
        </div>

        <div class="space-y-2">
          <Label for="share-nonce-pp">Share Nonce (hex)</Label>
          <Input
            id="share-nonce-pp"
            bind:value={shareNonceInput}
            placeholder="24 hex characters (12 bytes)"
            class="font-mono text-xs"
          />
        </div>

        <Button
          onclick={recoverWithPassphrase}
          disabled={recoveringPassphrase || !passphraseInput || !bundleJsonInput || !shareDataInput || !shareNonceInput}
          class="w-full"
        >
          {#if recoveringPassphrase}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Recovering...
          {:else}
            <KeyRound class="mr-2 h-4 w-4" />
            Decrypt Share
          {/if}
        </Button>
      </div>
    {/if}

    <!-- Step 3: Results -->
    {#if currentStep === 'result'}
      <div class="space-y-6">
        <div class="flex items-center gap-2">
          <CheckCircle class="text-primary h-5 w-5" />
          <h2 class="font-space text-xl font-bold tracking-tight">Recovered Shares</h2>
        </div>
        <p class="text-muted-foreground text-sm">
          {decryptedShares.length} share{decryptedShares.length !== 1 ? 's' : ''} decrypted successfully.
        </p>

        {#each decryptedShares as result, i}
          <div class="bg-muted rounded-lg p-4">
            <div class="mb-2 flex items-center justify-between">
              <h4 class="text-sm font-medium">
                {#if result.shareIndex > 0}
                  Share {result.shareIndex} of {result.totalShares}
                {:else}
                  Share {i + 1}
                {/if}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => copyToClipboard(result.share)}
              >
                <Copy class="mr-1 h-3 w-3" />
                Copy
              </Button>
            </div>
            <pre class="bg-background overflow-x-auto rounded border p-3 font-mono text-xs break-all whitespace-pre-wrap">{result.share}</pre>
            {#if result.threshold > 0}
              <p class="text-muted-foreground mt-2 text-xs">
                Requires {result.threshold} of {result.totalShares} shares to reconstruct the secret.
                {#if result.secretId !== 'manual' && result.secretId !== 'unknown'}
                  Secret ID: {result.secretId}
                {/if}
              </p>
            {/if}
          </div>
        {/each}

        <Alert.Alert class="mt-4">
          <AlertTriangle class="h-4 w-4" />
          <Alert.AlertTitle>Next Steps</Alert.AlertTitle>
          <Alert.AlertDescription>
            To reconstruct the original secret, you need at least the threshold number of shares.
            Combine them using a Shamir's Secret Sharing reconstruction tool.
          </Alert.AlertDescription>
        </Alert.Alert>
      </div>
    {/if}
  </div>
</div>
