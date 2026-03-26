<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import * as Alert from '$lib/components/ui/alert';
  import { toast } from 'svelte-sonner';
  import {
    Shield,
    CheckCircle,
    AlertTriangle,
    Copy,
    ArrowLeft,
  } from '@lucide/svelte';
  import type { DecryptedShareResult } from '$lib/crypto/recovery-flows';
  import SSSDecryptor from '$lib/components/SSSDecryptor.svelte';

  interface Props {
    decryptedShares: DecryptedShareResult[];
    recoveredShares: string[];
    onRecoverAnother: () => void;
  }

  let { decryptedShares, recoveredShares, onRecoverAnother }: Props = $props();

  let showReconstruct = $state(false);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

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

  <!-- Reconstruct Secret Section -->
  <Separator />
  <div class="space-y-4">
    <h3 class="font-space text-lg font-bold tracking-tight">Reconstruct Secret</h3>
    <p class="text-muted-foreground text-sm">
      {recoveredShares.length} share{recoveredShares.length !== 1 ? 's' : ''} recovered so far.
      You need at least 2 shares to reconstruct the original secret.
    </p>

    {#if !showReconstruct}
      <div class="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          onclick={onRecoverAnother}
          class="flex-1"
        >
          <ArrowLeft class="mr-2 h-4 w-4" />
          Recover Another Share
        </Button>
        <Button
          onclick={() => (showReconstruct = true)}
          disabled={recoveredShares.length < 2}
          class="flex-1"
        >
          <Shield class="mr-2 h-4 w-4" />
          Reconstruct Secret
        </Button>
      </div>

      {#if recoveredShares.length < 2}
        <Alert.Alert>
          <AlertTriangle class="h-4 w-4" />
          <Alert.AlertTitle>More shares needed</Alert.AlertTitle>
          <Alert.AlertDescription>
            You need at least 2 shares to reconstruct the secret. Use "Recover Another Share"
            to decrypt additional shares using a different recovery method or key.
          </Alert.AlertDescription>
        </Alert.Alert>
      {/if}
    {:else}
      <Button
        variant="ghost"
        onclick={() => (showReconstruct = false)}
        class="mb-2"
      >
        <ArrowLeft class="mr-2 h-4 w-4" />
        Back to shares
      </Button>
      <SSSDecryptor initialShares={recoveredShares} />
    {/if}
  </div>
</div>
