<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';
  import UpgradeModal from '$lib/components/UpgradeModal.svelte';
  import ThresholdSelector from '$lib/components/ThresholdSelector.svelte';
  import { AlertCircle, AlertTriangle, Crown, Info, Lock, Plus, Trash2 } from '@lucide/svelte';
  import { Buffer } from 'buffer';
  import sss from 'shamirs-secret-sharing';

  let {
    isPaid = false,
    tierInfo
  }: {
    isPaid?: boolean;
    tierInfo?: {
      secretsUsed: number;
      secretsLimit: number;
      canCreate: boolean;
      recipientsLimit: number;
    };
  } = $props();

  let error = $state<string | null>(null);
  let showUpgradeModal = $state(false);
  let isSubmitting = $state(false);

  // Form state
  let title = $state('');
  let secretMessageContent = $state('');
  let recipients = $state<Array<{ name: string; email: string }>>([{ name: '', email: '' }]);
  let checkInDays = $state('365');
  let sssSharesTotal = $state(3);
  let sssThreshold = $state(2);

  const maxRecipients = isPaid ? 5 : 1;
  let canAddMore = $derived(recipients.length < maxRecipients);

  const percentageUsed = tierInfo ? (tierInfo.secretsUsed / tierInfo.secretsLimit) * 100 : 0;
  const showWarning = tierInfo && percentageUsed >= 75 && tierInfo.canCreate;
  const isAtLimit = tierInfo && !tierInfo.canCreate;

  function addRecipient() {
    recipients = [...recipients, { name: '', email: '' }];
  }

  function removeRecipient(index: number) {
    recipients = recipients.filter((_, i) => i !== index);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    isSubmitting = true;

    try {
      // Validate
      if (!title.trim()) throw new Error('Title is required');
      if (!secretMessageContent.trim()) throw new Error('Secret message is required');
      if (recipients.length === 0) throw new Error('At least one recipient is required');

      // SSS split client-side
      const secretBuffer = Buffer.from(secretMessageContent, 'utf8');
      const shares = sss.split(secretBuffer, {
        shares: sssSharesTotal,
        threshold: sssThreshold
      });

      if (shares.length < sssSharesTotal || shares.length === 0) {
        throw new Error('Failed to generate the required number of SSS shares.');
      }

      const userManagedShares: string[] = [];
      for (let i = 1; i < shares.length; i++) {
        userManagedShares.push(shares[i].toString('hex'));
      }

      const serverSharePlainHex = shares[0].toString('hex');

      // Get CSRF token
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const payload = {
        title,
        server_share: serverSharePlainHex,
        recipients,
        check_in_days: parseInt(checkInDays, 10),
        sss_shares_total: sssSharesTotal,
        sss_threshold: sssThreshold
      };

      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to create secret via API');
      if (!result.secretId) throw new Error('API did not return a secret ID.');

      // Store shares in localStorage with 2 hour expiry
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
      localStorage.setItem(
        `keyfate:userManagedShares:${result.secretId}`,
        JSON.stringify({ shares: userManagedShares, expiresAt })
      );

      const queryParams = new URLSearchParams({
        secretId: result.secretId,
        sss_shares_total: sssSharesTotal.toString(),
        sss_threshold: sssThreshold.toString(),
        recipients: encodeURIComponent(
          JSON.stringify(recipients.map((r) => ({ name: r.name, email: r.email })))
        )
      });

      goto(`/secrets/${result.secretId}/share-instructions?${queryParams.toString()}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Submit error:', err);
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if error}
  <Alert.Root variant="destructive" class="mb-6">
    <AlertCircle class="h-4 w-4" />
    <Alert.Title>Error Creating Secret</Alert.Title>
    <Alert.Description>{error}</Alert.Description>
  </Alert.Root>
{/if}

{#if isAtLimit}
  <Alert.Root variant="destructive" class="mb-6">
    <AlertCircle class="h-4 w-4" />
    <Alert.Title>Secret Limit Reached</Alert.Title>
    <Alert.Description>
      You've used all {tierInfo?.secretsLimit} of your {isPaid ? 'Pro' : 'Free'} tier secrets.
      {#if !isPaid}Upgrade to Pro to create up to 10 secrets.{/if}
    </Alert.Description>
  </Alert.Root>
{/if}

{#if showWarning}
  <Alert.Root class="border-muted bg-muted/50 mb-6">
    <AlertTriangle class="text-muted-foreground h-4 w-4" />
    <Alert.Title class="text-foreground">Approaching Limit</Alert.Title>
    <Alert.Description class="text-muted-foreground">
      You're using {tierInfo?.secretsUsed} of {tierInfo?.secretsLimit} secrets ({Math.round(percentageUsed)}%).
      {#if !isPaid}Consider upgrading to Pro for 10 secrets.{/if}
    </Alert.Description>
  </Alert.Root>
{/if}

<form onsubmit={handleSubmit} class="space-y-6">
  <!-- Secret Details -->
  <div class="space-y-4">
    <div class="space-y-2">
      <Label for="title">Secret Title</Label>
      <Input
        id="title"
        bind:value={title}
        placeholder="Example: Grandma's Recipe Book Location"
        disabled={isSubmitting}
      />
    </div>

    <div class="space-y-2">
      <Label for="secretMessage" class="flex items-center gap-1">
        Secret Message
        <Lock class="h-3 w-3" />
      </Label>
      <Textarea
        id="secretMessage"
        bind:value={secretMessageContent}
        placeholder="Your secret message."
        rows={4}
        disabled={isSubmitting}
      />
      <p class="text-muted-foreground text-xs">
        This message will be split using Shamir's Secret Sharing. You'll manage the shares on the
        next page.
      </p>
    </div>
  </div>

  <!-- Recipients -->
  <div class="space-y-4 border-t pt-6">
    <div class="flex items-center justify-between">
      <h2 class="text-muted-foreground text-sm font-medium">Recipients</h2>
      {#if !isPaid && recipients.length >= 1}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => (showUpgradeModal = true)}
          class="h-8 gap-1.5 text-xs"
        >
          <Crown class="h-3 w-3" />
          Add More (Pro)
        </Button>
      {/if}
    </div>

    <div class="space-y-3">
      {#each recipients as recipient, index}
        <div class="bg-muted/30 space-y-3 rounded-md border p-3">
          <div class="flex items-center justify-between">
            <div class="text-muted-foreground text-xs font-medium">Recipient {index + 1}</div>
            {#if recipients.length > 1}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => removeRecipient(index)}
                disabled={isSubmitting}
                class="h-7 w-7 p-0"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            {/if}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label class="text-xs">Name</Label>
              <Input
                bind:value={recipient.name}
                placeholder="Jane Doe"
                disabled={isSubmitting}
                class="h-9"
              />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">Email</Label>
              <Input
                type="email"
                bind:value={recipient.email}
                placeholder="recipient@example.com"
                disabled={isSubmitting}
                class="h-9"
              />
            </div>
          </div>
        </div>
      {/each}

      {#if isPaid && canAddMore}
        <Button
          type="button"
          variant="outline"
          onclick={addRecipient}
          disabled={isSubmitting}
          class="h-9 w-full text-sm"
        >
          <Plus class="mr-1.5 h-4 w-4" />
          Add Recipient ({recipients.length} / {maxRecipients})
        </Button>
      {/if}
    </div>
  </div>

  <!-- Check-in Settings -->
  <div class="space-y-4 border-t pt-6">
    <h2 class="text-muted-foreground text-sm font-medium">Check-in Settings</h2>
    <div class="space-y-2">
      <Label for="checkInDays">Trigger Deadline</Label>
      <Select.Root type="single" bind:value={checkInDays}>
        <Select.Trigger>
          <span>{checkInDays ? `${checkInDays} days` : 'Select frequency'}</span>
        </Select.Trigger>
        <Select.Content>
          {#if isPaid}
            <Select.Item value="1">1 day</Select.Item>
            <Select.Item value="3">3 days</Select.Item>
            <Select.Item value="7">1 week</Select.Item>
            <Select.Item value="14">2 weeks</Select.Item>
            <Select.Item value="30">1 month</Select.Item>
            <Select.Item value="90">3 months</Select.Item>
            <Select.Item value="180">6 months</Select.Item>
            <Select.Item value="365">1 year</Select.Item>
            <Select.Item value="1095">3 years</Select.Item>
          {:else}
            <Select.Item value="7">1 week</Select.Item>
            <Select.Item value="30">1 month</Select.Item>
            <Select.Item value="365">1 year</Select.Item>
          {/if}
        </Select.Content>
      </Select.Root>
      <p class="text-muted-foreground text-xs">
        {isPaid
          ? 'How long until your secret is automatically disclosed. Checking in will start the timer over.'
          : 'How long until your secret is automatically disclosed. Upgrade to Pro for more interval options.'}
      </p>
    </div>
  </div>

  <!-- Advanced Settings -->
  <div class="space-y-4 border-t pt-6">
    <Accordion.Root type="single">
      <Accordion.Item value="sss-config" class="border-0">
        <Accordion.Trigger
          class="text-muted-foreground hover:text-foreground py-0 text-sm font-medium hover:no-underline"
        >
          Advanced Settings (optional)
        </Accordion.Trigger>
        <Accordion.Content class="space-y-3 pt-4">
          {#if recipients.length > 1}
            <Alert.Root>
              <Info class="h-4 w-4" />
              <Alert.Title class="text-sm">Multiple Recipients</Alert.Title>
              <Alert.Description class="text-xs">
                All recipients will receive the SAME share. You must distribute this share to each
                recipient separately via your own secure channels.
              </Alert.Description>
            </Alert.Root>
          {/if}
          <Alert.Root>
            <Info class="h-4 w-4" />
            <Alert.Title class="text-sm">Secret Sharing Details</Alert.Title>
            <Alert.Description class="text-xs">
              <ul class="list-disc space-y-0.5 pl-5">
                <li>Your secret message will be split into cryptographic "shares".</li>
                <li>A minimum number of shares (threshold) will be required to reconstruct.</li>
                <li>KeyFate will securely store one share. You will manage the others.</li>
              </ul>
            </Alert.Description>
          </Alert.Root>
          <ThresholdSelector
            bind:sharesTotalValue={sssSharesTotal}
            bind:thresholdValue={sssThreshold}
            isPro={isPaid}
            {isSubmitting}
            onUpgradeClick={() => (showUpgradeModal = true)}
          />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  </div>

  <Button type="submit" disabled={isSubmitting || !!isAtLimit} class="w-full">
    {isSubmitting
      ? 'Processing & Encrypting...'
      : isAtLimit
        ? 'Secret Limit Reached - Upgrade Required'
        : 'Create Secret & Proceed to Share Management'}
  </Button>
</form>

<UpgradeModal
  bind:open={showUpgradeModal}
  onOpenChange={(v) => (showUpgradeModal = v)}
  feature="multiple recipients per secret"
  currentLimit="1 recipient"
  proLimit="Up to 5 recipients"
/>
