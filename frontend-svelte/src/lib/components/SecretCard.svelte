<script lang="ts">
  import CheckInButton from '$lib/components/CheckInButton.svelte';
  import DataLabel from '$lib/components/DataLabel.svelte';
  import Keyline from '$lib/components/Keyline.svelte';
  import TogglePauseButton from '$lib/components/TogglePauseButton.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { formatGranularTime } from '$lib/time-utils';
  import type { Secret, SecretWithRecipients } from '$lib/types/secret-types';
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
    colorClass: string;
  }

  function getStatusBadge(
    status: SecretWithRecipients['status'],
    nextCheckIn: Date | null,
    triggeredAt: Date | null,
    shareDeleted: boolean
  ): StatusBadge {
    if (triggeredAt || status === 'triggered') {
      return { label: 'Sent', colorClass: 'border-muted-foreground/50 text-muted-foreground' };
    }
    if (shareDeleted) {
      return { label: 'Disabled', colorClass: 'border-muted-foreground/50 text-muted-foreground' };
    }
    if (status === 'paused') {
      return { label: 'Paused', colorClass: 'border-warning/50 bg-warning/10 text-warning' };
    }

    const now = new Date();
    const checkInDate = nextCheckIn ? new Date(nextCheckIn) : new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn <= 2) return { label: 'Urgent', colorClass: 'border-destructive/50 bg-destructive/10 text-destructive' };
    if (daysUntilCheckIn <= 5) return { label: 'Upcoming', colorClass: 'border-warning/50 bg-warning/10 text-warning' };
    return { label: 'Active', colorClass: 'border-success/50 bg-success/10 text-success' };
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

  /** Keyline progress: percentage of check-in interval elapsed */
  let keylineProgress = $derived.by(() => {
    if (isTriggered || serverShareDeleted || secretState.status === 'paused') return 0;
    const now = new Date();
    const nextCheckIn = secretState.nextCheckIn ? new Date(secretState.nextCheckIn) : now;
    const intervalMs = secretState.checkInDays * 24 * 60 * 60 * 1000;
    const startMs = nextCheckIn.getTime() - intervalMs;
    const elapsed = now.getTime() - startMs;
    return Math.max(0, Math.min(100, (elapsed / intervalMs) * 100));
  });

  /** Massive countdown text */
  let countdownText = $derived.by(() => {
    if (isTriggered) return 'Sent';
    if (serverShareDeleted) return '—';
    if (secretState.status === 'paused') return 'Paused';
    return formatGranularTime(secretState.nextCheckIn || new Date());
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

  function getRecipientsText(): string {
    const count = secretState.recipients.length;
    return `${count} ${count === 1 ? 'recipient' : 'recipients'}`;
  }

  function getLastCheckInText(): string | null {
    if (!secretState.lastCheckIn || isTriggered || serverShareDeleted) return null;
    return format(secretState.lastCheckIn);
  }

  function getNextCheckInDate(): string | null {
    if (isTriggered || serverShareDeleted || secretState.status === 'paused') return null;
    const triggerDate = secretState.nextCheckIn
      ? new Date(secretState.nextCheckIn)
      : new Date();
    return triggerDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<!-- Unboxed secret row — no Card wrapper -->
<div class="py-10">
  <!-- Header: title + status badge -->
  <div class="flex items-start justify-between gap-4">
    <h3 class="font-space text-xl font-semibold tracking-tight md:text-2xl">
      {secretState.title}
    </h3>
    <Badge variant="outline" class="shrink-0 text-xs uppercase tracking-wider {statusBadge.colorClass}">
      {statusBadge.label}
    </Badge>
  </div>

  <!-- Massive countdown -->
  <div
    class="font-space text-foreground -ml-1 mt-4 text-[3.5rem] font-light leading-none tracking-tighter sm:text-[5rem] md:text-[6rem]"
  >
    {countdownText}
  </div>

  <!-- Keyline progress bar -->
  {#if !isTriggered && !serverShareDeleted && secretState.status !== 'paused'}
    <Keyline progress={keylineProgress} />
  {:else}
    <div class="my-8 h-[2px] w-full bg-muted"></div>
  {/if}

  <!-- Metadata row: horizontal DataLabels -->
  <div class="flex flex-col gap-6 md:flex-row md:justify-between">
    <DataLabel label="Recipients" value={getRecipientsText()} />

    {#if getNextCheckInDate()}
      <DataLabel label="Triggers On" value={getNextCheckInDate()} />
    {/if}

    {#if getLastCheckInText()}
      <DataLabel label="Last Check-In" value={getLastCheckInText()} />
    {/if}

    {#if isTriggered && secretState.triggeredAt}
      <DataLabel label="Sent" value={format(secretState.triggeredAt)} />
    {/if}

    <DataLabel label="Interval" value={`${secretState.checkInDays} days`} />
  </div>

  <!-- Actions -->
  <div class="mt-8 flex items-center justify-between gap-4">
    {#if !isTriggered}
      <div class="flex items-center gap-2">
        {#if !serverShareDeleted}
          <TogglePauseButton
            secretId={secretState.id}
            status={secretState.status}
            onToggleSuccess={handleToggleSuccess}
          />
        {/if}

        <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/view`} class="">
          View
        </Button>

        {#if !serverShareDeleted}
          <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/edit`} class="">
            <Pencil class="mr-1 h-4 w-4" />
            Edit
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
      <Button variant="ghost" size="sm" href={`/secrets/${secretState.id}/view`} class="">
        View
      </Button>
    {/if}
  </div>
</div>
