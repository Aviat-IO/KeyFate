<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Alert from '$lib/components/ui/alert';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Separator } from '$lib/components/ui/separator';
  import { Copy, AlertTriangle, CheckCircle, Info, Send } from 'lucide-svelte';

  let userManagedShares = $state<string[]>([]);
  let recipients = $state<Array<{ name: string; email?: string | null }>>([]);
  let sssSharesTotal = $state(0);
  let sssThreshold = $state(0);
  let secretId = $state<string | null>(null);
  let error = $state<string | null>(null);
  let confirmedSent = $state(false);
  let copiedIndex = $state<number | null>(null);

  const isMinimalShares = $derived(sssSharesTotal === 2);

  onMount(() => {
    const searchParams = $page.url.searchParams;
    const id = searchParams.get('secretId');
    const total = parseInt(searchParams.get('sss_shares_total') || '0', 10);
    const threshold = parseInt(searchParams.get('sss_threshold') || '0', 10);
    const recipientsParam = searchParams.get('recipients');

    if (!id || total < 2 || threshold < 2 || threshold > total) {
      error =
        'Critical information missing or invalid. Unable to display share instructions. Please try creating the secret again.';
      return;
    }

    let parsedRecipients: Array<{ name: string; email?: string | null }> = [];
    if (recipientsParam) {
      try {
        parsedRecipients = JSON.parse(decodeURIComponent(recipientsParam));
      } catch {
        error = 'Failed to parse recipients. Please re-create the secret.';
        return;
      }
    }

    const local = localStorage.getItem(`keyfate:userManagedShares:${id}`);
    if (!local) {
      error =
        'Could not find your shares in this browser. They may have expired or been cleared. Please re-create the secret.';
      return;
    }

    let parsed: { shares: string[]; expiresAt: number };
    try {
      parsed = JSON.parse(local);
      if (!Array.isArray(parsed.shares) || typeof parsed.expiresAt !== 'number') {
        throw new Error();
      }
    } catch {
      error = 'Failed to parse your shares. Please re-create the secret.';
      return;
    }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`keyfate:userManagedShares:${id}`);
      error = 'Your shares have expired (over 2 hours old). Please re-create the secret.';
      return;
    }

    if (parsed.shares.length !== total - 1) {
      error = 'Share count mismatch. Please re-create the secret.';
      return;
    }

    secretId = id;
    userManagedShares = parsed.shares;
    sssSharesTotal = total;
    sssThreshold = threshold;
    recipients = parsedRecipients;
  });

  function handleCopy(shareHex: string, index: number) {
    navigator.clipboard.writeText(shareHex);
    copiedIndex = index;
    setTimeout(() => (copiedIndex = null), 2000);
  }

  function handleProceed() {
    if (confirmedSent) {
      goto('/dashboard');
    }
  }

  function createMailto(
    recipient: { name: string; email?: string | null },
    share: string
  ): string | null {
    if (!recipient.email || !share) return null;
    const subject = encodeURIComponent('Your KeyFate Secret Share');
    const bodyParts = [
      `Hi ${recipient.name || 'there'},`,
      '',
      `Here is your KeyFate secret share: ${share}`,
      '',
      'Please keep this very safe. You will need it (and one other share that KeyFate will provide if the secret expires) to reconstruct the original message.',
      '',
      "What is KeyFate? It's a dead man's switch service. The person who set this up has stored an encrypted message that will be made accessible to you if they fail to check in regularly.",
      '',
      'For more information on how to use this share for recovery, you will receive further instructions from KeyFate if/when the secret is triggered.'
    ];
    const body = encodeURIComponent(bodyParts.join('\n'));
    return `mailto:${recipient.email}?subject=${subject}&body=${body}`;
  }
</script>

<svelte:head>
  <title>Share Instructions - KeyFate</title>
</svelte:head>

{#if error}
  <div class="mx-auto max-w-2xl px-6 py-12">
    <Alert.Root variant="destructive">
      <AlertTriangle class="h-4 w-4" />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description>{error}</Alert.Description>
    </Alert.Root>
  </div>
{:else if !secretId || userManagedShares.length === 0}
  <div class="mx-auto max-w-2xl px-6 py-12 text-center">
    <p>Loading share information...</p>
  </div>
{:else}
  <div class="mx-auto max-w-2xl px-6 py-12">
    <h1 class="font-space mb-3 text-3xl font-light tracking-tight">Manage Your Secret Shares</h1>
    <p class="text-muted-foreground mb-10">
      Your secret has been successfully created and split into {sssSharesTotal} shares. You need {sssThreshold}
      shares to recover it.
    </p>
    <div class="space-y-10">
        <Alert.Root>
          <Info class="h-4 w-4" />
          <Alert.Title>How Recovery Works</Alert.Title>
          <Alert.Description>
            <p class="mb-2">
              Your secret requires <strong>{sssThreshold} of {sssSharesTotal}</strong> shares to recover.
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Share 0 (KeyFate):</strong> Automatically sent to recipients when triggered.</li>
              <li>
                <strong>Share 1 (Recipients):</strong> You must distribute this to each recipient via your
                own secure channel.
              </li>
              {#if !isMinimalShares}
                <li>
                  <strong>
                    {sssSharesTotal === 3
                      ? 'Share 2 (Backup):'
                      : `Shares 2-${sssSharesTotal - 1} (Backup):`}
                  </strong>
                  Store {sssSharesTotal === 3 ? 'this' : 'these'} securely offline for redundancy.
                </li>
              {/if}
            </ul>
          </Alert.Description>
        </Alert.Root>

        <!-- Share 1 display -->
        <div class="space-y-2">
          <Label class="font-space text-lg font-bold tracking-tight">
            Share 1: For ALL Recipients ({recipients.map((r) => r.name).join(', ')})
          </Label>
          <div class="flex items-center space-x-2">
            <Input readonly value={userManagedShares[0]} class="bg-muted truncate text-sm" />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onclick={() => handleCopy(userManagedShares[0], 0)}
            >
              {#if copiedIndex === 0}
                <CheckCircle class="text-accent-foreground h-4 w-4" />
              {:else}
                <Copy class="h-4 w-4" />
              {/if}
            </Button>
          </div>
          {#if copiedIndex === 0}
            <p class="text-accent-foreground text-xs">Copied!</p>
          {/if}
        </div>

        <!-- Distribution Checklist -->
        <div class="space-y-4">
          <h3 class="font-space text-lg font-bold tracking-tight">Distribution Checklist</h3>
          {#each recipients as recipient, index}
            <div class="flex items-start gap-3 rounded-md border border-border/50 p-3">
              <div class="flex-1">
                <p class="font-medium">{recipient.name}</p>
                <p class="text-muted-foreground text-sm">
                  {recipient.email || 'No email provided'}
                </p>
              </div>
              {#if recipient.email}
                {@const mailto = createMailto(recipient, userManagedShares[0])}
                {#if mailto}
                  <Button variant="outline" size="sm" href={mailto} class="font-semibold">
                    <Send class="mr-2 h-4 w-4" />
                    Email Share
                  </Button>
                {/if}
              {/if}
            </div>
          {/each}
        </div>

        {#if !isMinimalShares && userManagedShares.length > 1}
          <div class="space-y-4">
            <h3 class="font-space text-lg font-bold tracking-tight">Backup Shares</h3>
            <p class="text-muted-foreground text-sm">
              {sssThreshold === sssSharesTotal
                ? 'These shares are REQUIRED for recovery. Store them securely offline.'
                : 'Optional redundancy shares. Store securely offline.'}
            </p>
            {#each userManagedShares.slice(1) as share, index}
              <div class="space-y-2">
                <Label class="font-space text-lg font-bold tracking-tight">
                  Share {index + 2}: Backup Share {index + 1}
                </Label>
                <div class="flex items-center space-x-2">
                  <Input readonly value={share} class="bg-muted truncate text-sm" />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onclick={() => handleCopy(share, index + 1)}
                  >
                    {#if copiedIndex === index + 1}
                      <CheckCircle class="text-accent-foreground h-4 w-4" />
                    {:else}
                      <Copy class="h-4 w-4" />
                    {/if}
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <Alert.Root variant="destructive" class="mt-6">
          <AlertTriangle class="mt-0.5 h-5 w-5" />
          <Alert.Title class="text-lg">
            {sssThreshold === sssSharesTotal
              ? 'CRITICAL: All Shares Must Be Distributed'
              : 'Action Required: Distribute Share 1'}
          </Alert.Title>
          <Alert.Description class="text-foreground space-y-3">
            <p>
              Distribute Share 1 to each recipient using secure channels. Without it, recipients
              cannot recover your secret when triggered.
            </p>
            <p>
              <strong>Secure methods:</strong> Signal, password manager sharing, encrypted file,
              in-person, or email (buttons above).
            </p>
          </Alert.Description>
        </Alert.Root>

        <div class="mt-8 flex items-center space-x-2 rounded-md border border-border/50 p-4">
          <Checkbox
            id="confirm-sent"
            checked={confirmedSent}
            onCheckedChange={(checked) => (confirmedSent = checked === true)}
          />
          <Label
            for="confirm-sent"
            class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I have distributed {sssThreshold === sssSharesTotal ? 'all required shares' : 'Share 1'}
            and understand that recipients cannot recover the secret without them.
          </Label>
        </div>

        <div class="flex justify-end pt-8">
          <Button
            onclick={handleProceed}
            disabled={!confirmedSent || userManagedShares.length === 0}
            size="lg"
            class="w-full font-semibold md:w-auto"
          >
            {confirmedSent ? 'Proceed to Dashboard' : 'Confirm Shares Distributed to Proceed'}
          </Button>
        </div>
      </div>
  </div>
{/if}
