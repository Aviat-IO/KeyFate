<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';
  import { Loader2, KeyRound } from '@lucide/svelte';
  import {
    parseEncryptedKBundle,
    recoverKWithPassphrase,
    hexToBytes,
    type DecryptedShareResult,
  } from '$lib/crypto/recovery-flows';
  import { decryptShare } from '$lib/crypto/recovery';

  interface Props {
    onComplete: (results: DecryptedShareResult[]) => void;
    onError: (message: string) => void;
  }

  let { onComplete, onError }: Props = $props();

  let passphraseInput = $state('');
  let bundleJsonInput = $state('');
  let shareDataInput = $state('');
  let shareNonceInput = $state('');
  let recoveringPassphrase = $state(false);

  async function recoverWithPassphrase() {
    onError('');
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

      onComplete([
        {
          share: plaintext,
          shareIndex: 0,
          threshold: 0,
          totalShares: 0,
          secretId: 'manual',
        },
      ]);
      toast.success('Share decrypted successfully');
    } catch (e) {
      onError(`Passphrase recovery failed: ${e instanceof Error ? e.message : String(e)}`);
      toast.error('Failed to recover with passphrase');
    } finally {
      recoveringPassphrase = false;
    }
  }
</script>

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
