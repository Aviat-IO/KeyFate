<script lang="ts">
  import CheckInButton from '$lib/components/CheckInButton.svelte';
  import TogglePauseButton from '$lib/components/TogglePauseButton.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { formatGranularTime } from '$lib/time-utils';
  import type { Secret, SecretWithRecipients } from '$lib/types/secret-types';
  import { cn } from '$lib/utils';
  import { Pencil } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { format } from 'timeago.js';

  let { secret }: { secret: SecretWithRecipients } = $props();

  let secretState = $state<SecretWithRecipients>(secret);

  let serverShareDeleted = $derived(!secretState.serverShare);
  let isTriggered = $derived(
    secretState.triggeredAt !== null || secretState.status === 'triggered'
  );

  interface StatusBadge {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }

  function getStatusBadge(
    status: SecretWithRecipients['status'],
    nextCheckIn: Date | null,
    triggeredAt: Date | null,
    shareDeleted: boolean
  ): StatusBadge {
    if (triggeredAt || status === 'triggered') {
      return { label: 'Sent', variant: 'outline' };
    }
    if (shareDeleted) {
      return { label: 'Disabled', variant: 'outline' };
    }
    if (status === 'paused') {
      return { label: 'Paused', variant: 'outline' };
    }

    const now = new Date();
    const checkInDate = nextCheckIn ? new Date(nextCheckIn) : new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn <= 2) return { label: 'Urgent', variant: 'destructive' };
    if (daysUntilCheckIn <= 5) return { label: 'Upcoming', variant: 'default' };
    return { label: 'Active', variant: 'secondary' };
  }

  let statusBadge = $derived(
    getStatusBadge(
      secretState.status,
      secretState.nextCheckIn,
      secretState.triggeredAt,
      serverShareDeleted
    )
  );

  let canCheckIn = $derived.by(() => {
    if (!secretState.lastCheckIn) return true;
    const lastCheckIn = new Date(secretState.lastCheckIn);
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
    return lastCheckIn < fifteenMinutesAgo;
  });

  function handleCheckInSuccess(updatedSecret: Secret) {
    secretState = { ...secretState, ...updatedSecret };
    toast.success(`Your check-in for "${secret.title}" has been recorded.`, {
      description: 'Checked in successfully'
    });
  }

  function handleToggleSuccess(updatedSecret: Secret) {
    secretState = { ...secretState, ...updatedSecret };
    toast.success(
      `"${secret.title}" has been ${
        updatedSecret.status === 'active'
          ? 'resumed and a check-in has been applied'
          : 'paused'
      }.`,
      {
        description: updatedSecret.status === 'active' ? 'Secret resumed' : 'Secret paused'
      }
    );
  }

  function getTimingText() {
    if (isTriggered) return `Sent ${format(secretState.triggeredAt!)}`;
    if (serverShareDeleted) return 'Disabled';
    if (secretState.status === 'paused') return 'Paused';
    return `Triggers in ${formatGranularTime(secretState.nextCheckIn || new Date())}`;
  }

  function getTriggerTimeTooltip() {
    if (isTriggered || serverShareDeleted) return null;
    const triggerDate = secretState.nextCheckIn
      ? new Date(secretState.nextCheckIn)
      : new Date();
    return triggerDate.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  function getLastCheckInText() {
    if (!secretState.lastCheckIn || isTriggered || serverShareDeleted) return null;
    return `Last checkin: ${format(secretState.lastCheckIn)}`;
  }
</script>

<Card.Root
  class={cn(
    'flex flex-col transition-all duration-200',
    isTriggered && 'border-destructive/50 bg-destructive/5',
    secretState.status === 'paused' && 'border-accent bg-accent/10',
    serverShareDeleted && 'border-muted-foreground/30 bg-muted/50 opacity-90',
    statusBadge.label === 'Urgent' && 'border-destructive'
  )}
>
  <Card.Header class="flex-1 pb-4">
    <div class="mb-4 flex items-start justify-between">
      <h3 class="flex-1 truncate pr-2 text-base font-semibold md:text-xl">
        {secretState.title}
      </h3>
      <Badge variant={statusBadge.variant} class="text-xs md:text-sm">
        {statusBadge.label}
      </Badge>
    </div>

    <div class="space-y-3 md:space-y-4">
      <div>
        <div class="text-foreground mb-1.5 text-sm font-medium md:mb-2 md:text-base">
          {secretState.recipients.length}
          {secretState.recipients.length === 1 ? 'Recipient' : 'Recipients'}
        </div>
        <ul class="text-muted-foreground ml-1 space-y-0.5 text-xs md:space-y-1 md:text-sm">
          {#each secretState.recipients as recipient}
            <li>
              &bull; {recipient.name}
              {recipient.email
                ? `(${recipient.email})`
                : recipient.phone
                  ? `(${recipient.phone})`
                  : ''}
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <div class="text-foreground mb-1.5 text-sm font-medium md:mb-2 md:text-base">
          {getTimingText()}
        </div>
        {#if !isTriggered && !serverShareDeleted}
          {#if secretState.status === 'paused'}
            <div class="text-muted-foreground ml-1 text-xs md:text-sm">
              Will not trigger until resumed
            </div>
          {:else}
            <div class="text-muted-foreground ml-1 text-xs md:text-sm">
              {getTriggerTimeTooltip()}
            </div>
          {/if}
        {/if}
        {#if serverShareDeleted}
          <div class="text-muted-foreground ml-1 text-xs md:text-sm">Server share deleted</div>
        {/if}
      </div>

      {#if getLastCheckInText()}
        <div class="text-muted-foreground ml-1 text-xs md:text-sm">
          {getLastCheckInText()}
        </div>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="pt-0">
    <Separator class="mb-3" />

    <div class="flex items-center justify-between gap-2">
      {#if !isTriggered}
        <div class="flex items-center gap-2">
          {#if !serverShareDeleted}
            <TogglePauseButton
              secretId={secretState.id}
              status={secretState.status}
              onToggleSuccess={handleToggleSuccess}
            />
            <Separator orientation="vertical" class="h-4" />
          {/if}

          <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/view`}>
            View
          </Button>

          {#if !serverShareDeleted}
            <Separator orientation="vertical" class="h-4" />
            <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/edit`}>
              <Pencil class="mr-1 h-4 w-4" />
              <span class="hidden sm:inline">Edit</span>
            </Button>
          {/if}
        </div>

        <div>
          {#if !serverShareDeleted && secretState.status === 'active' && canCheckIn}
            <CheckInButton
              secretId={secretState.id}
              onCheckInSuccess={handleCheckInSuccess}
              variant="outline"
            />
          {/if}
        </div>
      {:else}
        <div></div>
        <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/view`}>
          View
        </Button>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
