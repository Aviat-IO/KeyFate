<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { toast } from 'svelte-sonner';
  import { Buffer } from 'buffer';
  import { Check, Copy, Info, PlusCircle, ShieldAlert, ShieldCheck, Trash2 } from '@lucide/svelte';
  import sss from 'shamirs-secret-sharing';

  let {
    initialShares = [],
    companyName = 'KeyFate'
  }: {
    initialShares?: string[];
    companyName?: string;
  } = $props();

  let shares = $state<string[]>(
    initialShares.length === 0
      ? ['', '']
      : initialShares.length === 1
        ? [initialShares[0], '']
        : [...initialShares]
  );
  let recoveredSecret = $state<string | null>(null);
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let isCopied = $state(false);

  function handleShareChange(index: number, value: string) {
    shares[index] = value.trim();
    recoveredSecret = null;
    error = null;
  }

  function addShareInput() {
    shares = [...shares, ''];
  }

  function removeShareInput(index: number) {
    if (shares.length <= 2) {
      error = 'You need at least two shares to attempt recovery.';
      return;
    }
    shares = shares.filter((_, i) => i !== index);
  }

  function handleCombineShares() {
    isLoading = true;
    error = null;
    recoveredSecret = null;

    const validShares = shares.filter((s) => s.trim() !== '');
    if (validShares.length < 2) {
      error = 'Please provide at least two shares.';
      isLoading = false;
      return;
    }

    try {
      const shareBuffers = validShares.map((shareHex) => {
        if (!/^[0-9a-fA-F]+$/.test(shareHex)) {
          throw new Error(
            `Invalid share format: "${shareHex.substring(0, 10)}...". Shares should be hexadecimal strings.`
          );
        }
        const sanitizedHex = shareHex.length % 2 !== 0 ? '0' + shareHex : shareHex;
        if (sanitizedHex.length === 0) {
          throw new Error('Empty share provided after sanitization.');
        }
        return Buffer.from(sanitizedHex, 'hex');
      });

      if (shareBuffers.length > 1) {
        const firstLength = shareBuffers[0].length;
        if (!shareBuffers.every((b) => b.length === firstLength)) {
          throw new Error(
            'Shares are not of the same length. Ensure you have copied them correctly.'
          );
        }
      }

      const recovered = sss.combine(shareBuffers);
      recoveredSecret = recovered.toString('utf8');
    } catch (e) {
      console.error('Error combining shares:', e);
      const errorMessage = e instanceof Error ? e.message : 'Invalid shares or threshold not met.';
      error = `Failed to recover secret: ${errorMessage}. Ensure shares are correct, in hexadecimal format, and you have enough of them.`;
    } finally {
      isLoading = false;
    }
  }

  async function handleCopySecret() {
    if (!recoveredSecret) return;

    try {
      await navigator.clipboard.writeText(recoveredSecret);
      isCopied = true;
      toast.success('Secret copied to clipboard successfully.');
      setTimeout(() => {
        isCopied = false;
      }, 2000);
    } catch (err) {
      console.error('Error copying secret:', err);
      toast.error('Failed to copy secret to clipboard.');
    }
  }
</script>

<div class="space-y-6">
  <div class="text-center">
    <h1 class="font-space mb-4 text-3xl font-bold">Secret Recovery</h1>
  </div>

  <div class="space-y-6">
    <div>
      <h2 class="font-space mb-2 text-xl font-semibold">Enter Your Shares</h2>
      <p class="text-muted-foreground text-sm">
        Enter your {companyName} shares below. You need a minimum number of correct shares (as per the
        threshold set during creation) to recover the original secret (shares are typically hexadecimal
        strings).
      </p>
    </div>

    <div class="space-y-4">
      {#each shares as share, index}
        <div class="flex items-center space-x-2">
          <Textarea
            placeholder={`Share ${index + 1} (from ${companyName} or your trusted contact)`}
            value={share}
            oninput={(e) => handleShareChange(index, (e.target as HTMLTextAreaElement).value)}
            rows={2}
            class="flex-grow font-mono text-sm"
            disabled={isLoading}
          />
          {#if shares.length > 2}
            <Button
              variant="ghost"
              size="icon"
              onclick={() => removeShareInput(index)}
              disabled={isLoading}
              aria-label="Remove share"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          {/if}
        </div>
      {/each}
      <Button
        type="button"
        variant="outline"
        onclick={addShareInput}
        disabled={isLoading}
        class="w-full sm:w-auto uppercase tracking-wide"
      >
        <PlusCircle class="mr-2 h-4 w-4" /> Add Another Share
      </Button>
    </div>

    <Button
      type="button"
      onclick={handleCombineShares}
      disabled={isLoading || shares.filter((s) => s.trim() !== '').length < 2}
      class="w-full text-lg uppercase tracking-wide"
      size="lg"
    >
      {isLoading ? 'Recovering...' : 'Recover Secret'}
    </Button>

    {#if error}
      <Alert.Root variant="destructive">
        <ShieldAlert class="h-4 w-4" />
        <Alert.Title>Recovery Failed</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if recoveredSecret}
      <Alert.Root variant="default" class="border-accent bg-accent/50">
        <ShieldCheck class="text-accent-foreground h-4 w-4" />
        <Alert.Title class="text-accent-foreground">Secret Recovered Successfully!</Alert.Title>
        <Alert.Description class="space-y-2">
          <p class="text-accent-foreground/90">Your original secret is:</p>
          <Textarea
            value={recoveredSecret}
            readonly
            rows={4}
            class="bg-muted mt-2 w-full select-all rounded-md border p-3 font-mono text-sm"
          />
          <Button
            type="button"
            variant={isCopied ? 'default' : 'outline'}
            size="sm"
            class="mt-2 transition-all duration-200"
            onclick={handleCopySecret}
            disabled={isCopied}
          >
            {#if isCopied}
              <Check class="mr-2 h-3 w-3" /> Copied!
            {:else}
              <Copy class="mr-2 h-3 w-3" /> Copy Recovered Secret
            {/if}
          </Button>
        </Alert.Description>
      </Alert.Root>
    {/if}
  </div>

  <div class="bg-muted/30 rounded-lg p-4">
    <div class="flex items-start space-x-3">
      <Info class="text-muted-foreground mt-0.5 h-4 w-4" />
      <div class="space-y-2 text-sm">
        <p class="text-muted-foreground">
          <strong>Educational demonstration:</strong> This tool runs entirely in your browser. Your
          shares are processed locally and never sent to servers. For maximum security with sensitive
          secrets, we recommend running this tool locally on your own device.
        </p>
        <a
          href="/local-instructions"
          class="text-muted-foreground h-auto p-0 text-xs underline"
        >
          Get setup instructions for local use &rarr;
        </a>
      </div>
    </div>
  </div>
</div>
