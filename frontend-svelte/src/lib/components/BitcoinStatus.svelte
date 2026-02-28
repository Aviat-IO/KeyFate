<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { toast } from 'svelte-sonner';
  import { AlertTriangle, Bitcoin, Clock, Loader2, RefreshCw } from '@lucide/svelte';

  let {
    secretId,
    onRefresh
  }: {
    secretId: string;
    onRefresh?: () => void;
  } = $props();

  interface BitcoinStatusData {
    status: 'pending' | 'confirmed' | 'expired' | 'none';
    amount?: number;
    txid?: string;
    csvBlocks?: number;
    blocksRemaining?: number;
    currentBlock?: number;
    expiresAtBlock?: number;
    confirmedAt?: string;
  }

  let statusData = $state<BitcoinStatusData | null>(null);
  let loading = $state(true);
  let refreshing = $state(false);
  let error = $state<string | null>(null);

  let statusVariant = $derived<'default' | 'secondary' | 'destructive' | 'outline'>(
    statusData?.status === 'confirmed'
      ? 'default'
      : statusData?.status === 'pending'
        ? 'secondary'
        : statusData?.status === 'expired'
          ? 'destructive'
          : 'outline'
  );

  let statusLabel = $derived(
    statusData?.status === 'confirmed'
      ? 'Confirmed'
      : statusData?.status === 'pending'
        ? 'Pending'
        : statusData?.status === 'expired'
          ? 'Expired'
          : 'Not Set Up'
  );

  let estimatedTimeRemaining = $derived.by(() => {
    if (!statusData?.blocksRemaining || statusData.blocksRemaining <= 0) return null;
    const minutes = statusData.blocksRemaining * 10;
    if (minutes < 60) return `~${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `~${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `~${days} day${days !== 1 ? 's' : ''}`;
  });

  async function fetchStatus() {
    try {
      const response = await fetch(`/api/secrets/${secretId}/bitcoin-status`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch Bitcoin status');
      }
      statusData = await response.json();
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load status';
    } finally {
      loading = false;
    }
  }

  async function handleRefresh() {
    refreshing = true;
    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secretId}/refresh-bitcoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to refresh Bitcoin UTXO');
      }

      toast.success('Bitcoin UTXO refreshed (check-in)');
      await fetchStatus();
      onRefresh?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message, { description: 'Refresh failed' });
    } finally {
      refreshing = false;
    }
  }

  $effect(() => {
    fetchStatus();
  });
</script>

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between">
      <Card.Title class="flex items-center gap-2">
        <Bitcoin class="h-5 w-5" />
        Bitcoin Timelock
      </Card.Title>
      {#if statusData}
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      {/if}
    </div>
  </Card.Header>
  <Card.Content>
    {#if loading}
      <div class="space-y-3">
        <div class="bg-muted h-4 w-3/4 animate-pulse rounded"></div>
        <div class="bg-muted h-4 w-1/2 animate-pulse rounded"></div>
        <div class="bg-muted h-4 w-2/3 animate-pulse rounded"></div>
      </div>
    {:else if error}
      <Alert.Root variant="destructive">
        <AlertTriangle class="h-4 w-4" />
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {:else if statusData?.status === 'none'}
      <p class="text-muted-foreground text-sm">
        No Bitcoin timelock configured for this secret.
      </p>
    {:else if statusData}
      <div class="space-y-3 text-sm">
        {#if statusData.amount}
          <div class="flex justify-between">
            <span class="text-muted-foreground">Amount locked</span>
            <span class="font-medium">{statusData.amount.toLocaleString()} sats</span>
          </div>
        {/if}

        {#if statusData.txid}
          <div class="flex justify-between">
            <span class="text-muted-foreground">Transaction</span>
            <span class="max-w-[200px] truncate font-mono text-xs">{statusData.txid}</span>
          </div>
        {/if}

        {#if statusData.csvBlocks}
          <div class="flex justify-between">
            <span class="text-muted-foreground">CSV delay</span>
            <span>{statusData.csvBlocks.toLocaleString()} blocks</span>
          </div>
        {/if}

        {#if statusData.currentBlock}
          <div class="flex justify-between">
            <span class="text-muted-foreground">Current block</span>
            <span>{statusData.currentBlock.toLocaleString()}</span>
          </div>
        {/if}

        {#if statusData.expiresAtBlock}
          <div class="flex justify-between">
            <span class="text-muted-foreground">Expires at block</span>
            <span>{statusData.expiresAtBlock.toLocaleString()}</span>
          </div>
        {/if}

        {#if statusData.blocksRemaining != null && statusData.blocksRemaining > 0}
          <Separator />
          <div class="flex items-center gap-2">
            <Clock class="text-muted-foreground h-4 w-4" />
            <div>
              <span class="font-medium">{statusData.blocksRemaining.toLocaleString()} blocks remaining</span>
              {#if estimatedTimeRemaining}
                <span class="text-muted-foreground ml-1">({estimatedTimeRemaining})</span>
              {/if}
            </div>
          </div>
        {/if}

        {#if statusData.status === 'expired'}
          <Alert.Root variant="destructive" class="mt-2">
            <AlertTriangle class="h-4 w-4" />
            <Alert.Description class="text-xs">
              The CSV timelock has expired. The recipient can now spend the locked funds.
            </Alert.Description>
          </Alert.Root>
        {/if}
      </div>
    {/if}
  </Card.Content>
  {#if statusData && statusData.status !== 'none'}
    <Card.Footer>
      <Button
        variant="outline"
        onclick={handleRefresh}
        disabled={refreshing}
        class="w-full"
      >
        {#if refreshing}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Refreshing...
        {:else}
          <RefreshCw class="mr-2 h-4 w-4" />
          Refresh UTXO (Check-in)
        {/if}
      </Button>
    </Card.Footer>
  {/if}
</Card.Root>
