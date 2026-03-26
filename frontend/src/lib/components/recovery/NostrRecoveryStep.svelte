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
    Search,
    Bitcoin,
    KeyRound,
    CheckCircle,
    AlertTriangle,
    ArrowRight,
    Eye,
    EyeOff,
  } from '@lucide/svelte';
  import {
    isValidNsec,
    nsecToSecretKey,
    unwrapGiftWrap,
    parseEncryptedKBundle,
    recoverKWithPassphrase,
    decryptShareWithK,
    hexToBytes,
    type FoundGiftWrap,
    type UnwrappedShare,
    type DecryptedShareResult,
  } from '$lib/crypto/recovery-flows';
  import { createNostrClient } from '$lib/nostr/client';
  import { publicKeyFromSecret } from '$lib/nostr/keypair';
  import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
  import { recoverKFromOpReturn, decryptShare } from '$lib/crypto/recovery';

  interface Props {
    onComplete: (results: DecryptedShareResult[]) => void;
    onError: (message: string) => void;
  }

  let { onComplete, onError }: Props = $props();

  let nsecInput = $state('');
  let nsecVisible = $state(false);
  let searchingRelays = $state(false);
  let foundEvents = $state<FoundGiftWrap[]>([]);
  let selectedEventIndices = $state<Set<number>>(new Set());
  let unwrappedShares = $state<UnwrappedShare[]>([]);
  let unwrapping = $state(false);

  let kRecoveryMethod = $state<'passphrase' | 'opreturn' | null>(null);
  let kPassphrase = $state('');
  let kBundleJson = $state('');
  let kOpReturnHex = $state('');
  let nonceHex = $state('');
  let recoveringK = $state(false);

  let nsecValid = $derived(nsecInput.trim().length > 0 && isValidNsec(nsecInput.trim()));
  let canSearchRelays = $derived(nsecValid && !searchingRelays);
  let hasSelectedEvents = $derived(selectedEventIndices.size > 0);

  function toggleEventSelection(index: number) {
    const next = new Set(selectedEventIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    selectedEventIndices = next;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }

  function truncateHex(hex: string, len = 16): string {
    if (hex.length <= len * 2) return hex;
    return `${hex.slice(0, len)}...${hex.slice(-len)}`;
  }

  async function searchRelays() {
    if (!nsecValid) return;
    onError('');
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
      onError(`Relay search failed: ${e instanceof Error ? e.message : String(e)}`);
      toast.error('Relay search failed');
    } finally {
      searchingRelays = false;
    }
  }

  async function unwrapSelectedEvents() {
    if (!hasSelectedEvents || !nsecValid) return;
    onError('');
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
      onError(`Unwrap failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      unwrapping = false;
    }
  }

  async function decryptSharesWithK() {
    if (!kRecoveryMethod) return;
    onError('');
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
        if (!kOpReturnHex) {
          throw new Error('OP_RETURN hex data is required');
        }
        const opReturnBytes = hexToBytes(kOpReturnHex.trim());
        K = recoverKFromOpReturn(opReturnBytes);
      }

      if (!nonceHex || !nonceHex.trim()) {
        throw new Error('Share nonce is required for decryption');
      }

      const results: DecryptedShareResult[] = [];
      for (const share of unwrappedShares) {
        try {
          const encShare = hexToBytes(share.share);
          const plaintext = decryptShare(encShare, hexToBytes(nonceHex.trim()), K);
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
        onComplete(results);
        toast.success(`Decrypted ${results.length} share(s)`);
      }
    } catch (e) {
      onError(`K recovery failed: ${e instanceof Error ? e.message : String(e)}`);
      toast.error('Failed to recover symmetric key');
    } finally {
      recoveringK = false;
    }
  }
</script>

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
                <p class="text-xs font-medium">Event {i + 1}</p>
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
