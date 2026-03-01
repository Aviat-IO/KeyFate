<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';
  import { Loader2, Bitcoin, ArrowRight } from '@lucide/svelte';
  import {
    parseOpReturnFromTx,
    hexToBytes,
    bytesToHex,
    type DecryptedShareResult,
  } from '$lib/crypto/recovery-flows';
  import { createNostrClient } from '$lib/nostr/client';
  import { DEFAULT_RELAYS } from '$lib/nostr/relay-config';
  import { decryptShare } from '$lib/crypto/recovery';

  interface Props {
    onComplete: (results: DecryptedShareResult[]) => void;
    onError: (message: string) => void;
  }

  let { onComplete, onError }: Props = $props();

  let txHexInput = $state('');
  let parsingTx = $state(false);
  let parsedOpReturn = $state<{ symmetricKeyK: Uint8Array; nostrEventId: string } | null>(null);
  let fetchingNostrEvent = $state(false);

  async function parseBitcoinTx() {
    onError('');
    parsingTx = true;
    parsedOpReturn = null;

    try {
      const result = parseOpReturnFromTx(txHexInput.trim());
      parsedOpReturn = result;
      toast.success('OP_RETURN data extracted successfully');
    } catch (e) {
      onError(`Transaction parsing failed: ${e instanceof Error ? e.message : String(e)}`);
      toast.error('Failed to parse transaction');
    } finally {
      parsingTx = false;
    }
  }

  async function fetchAndDecryptFromBitcoin() {
    if (!parsedOpReturn) return;
    onError('');
    fetchingNostrEvent = true;

    try {
      const { symmetricKeyK, nostrEventId } = parsedOpReturn;
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

        const payload = JSON.parse(event.content);
        const encShare = hexToBytes(payload.encryptedShare);
        const nonce = hexToBytes(payload.nonce);
        const plaintext = decryptShare(encShare, nonce, symmetricKeyK);

        onComplete([
          {
            share: plaintext,
            shareIndex: payload.shareIndex ?? 1,
            threshold: payload.threshold ?? 0,
            totalShares: payload.totalShares ?? 0,
            secretId: payload.secretId ?? 'unknown',
          },
        ]);
        toast.success('Share decrypted successfully');
      } finally {
        client.close();
      }
    } catch (e) {
      onError(`Recovery failed: ${e instanceof Error ? e.message : String(e)}`);
      toast.error('Failed to fetch or decrypt share');
    } finally {
      fetchingNostrEvent = false;
    }
  }
</script>

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
          <p class="text-xs text-muted-foreground font-medium">Symmetric Key K</p>
          <p class="font-mono text-xs break-all">
            {bytesToHex(parsedOpReturn.symmetricKeyK)}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground font-medium">Nostr Event ID</p>
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
