<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { toast } from 'svelte-sonner';
  import { AlertTriangle, Bitcoin, Clock, Loader2, RefreshCw } from '@lucide/svelte';
  import { hex } from '@scure/base';
  import { refreshBitcoinClient } from '$lib/bitcoin/client-operations';
  import { getStoredKeypair, getBitcoinMeta } from '$lib/bitcoin/client-wallet';

  let {
    secretId,
    onRefresh
  }: {
    secretId: string;
    onRefresh?: () => void;
  } = $props();

  interface BitcoinUtxoData {
    id: string;
    txId: string;
    outputIndex: number;
    amountSats: number;
    ttlBlocks: number;
    status: string;
    confirmedAt: string | null;
    createdAt: string;
    timelockScript: string;
    ownerPubkey: string;
    recipientPubkey: string;
  }

  interface BitcoinStatusData {
    enabled: boolean;
    utxo: BitcoinUtxoData | null;
    estimatedDaysRemaining: number | null;
    refreshesRemaining: number | null;
    hasPreSignedTx: boolean;
    network: 'mainnet' | 'testnet' | null;
  }

  let statusData = $state<BitcoinStatusData | null>(null);
  let loading = $state(true);
  let refreshing = $state(false);
  let error = $state<string | null>(null);

  let statusVariant = $derived<'default' | 'secondary' | 'destructive' | 'outline'>(
    statusData?.utxo?.status === 'confirmed'
      ? 'default'
      : statusData?.utxo?.status === 'pending'
        ? 'secondary'
        : statusData?.utxo?.status === 'expired'
          ? 'destructive'
          : 'outline'
  );

  let statusLabel = $derived(
    statusData?.utxo?.status === 'confirmed'
      ? 'Confirmed'
      : statusData?.utxo?.status === 'pending'
        ? 'Pending'
        : statusData?.utxo?.status === 'expired'
          ? 'Expired'
          : 'Not Set Up'
  );

  let estimatedTimeRemaining = $derived.by(() => {
    if (!statusData?.estimatedDaysRemaining || statusData.estimatedDaysRemaining <= 0) return null;
    const days = statusData.estimatedDaysRemaining;
    if (days < 1) {
      const hours = Math.round(days * 24);
      if (hours < 1) return `~${Math.round(days * 24 * 60)} minutes`;
      return `~${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `~${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
  });

  let canRefresh = $derived(
    statusData?.enabled &&
    statusData?.utxo &&
    (statusData.utxo.status === 'confirmed' || statusData.utxo.status === 'pending')
  );

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
    if (!statusData?.utxo || !statusData.network) {
      toast.error('No active UTXO to refresh');
      return;
    }

    // Load keypairs from sessionStorage
    const ownerKeypair = getStoredKeypair(secretId, 'owner');
    const recipientKeypair = getStoredKeypair(secretId, 'recipient');

    if (!ownerKeypair) {
      toast.error('Owner keypair not found in session', {
        description: 'Bitcoin keys are only available in the browser session where they were created. You may need to re-enable Bitcoin for this secret.'
      });
      return;
    }

    if (!recipientKeypair) {
      toast.error('Recipient keypair not found in session', {
        description: 'Bitcoin keys are only available in the browser session where they were created. You may need to re-enable Bitcoin for this secret.'
      });
      return;
    }

    refreshing = true;
    try {
      const utxo = statusData.utxo;
      const network = statusData.network;

      // We need symmetricKeyK and nostrEventId for the OP_RETURN in the pre-signed tx.
      // These are stored in sessionStorage alongside the keypairs.
      const storedMeta = getBitcoinMeta(secretId);
      if (!storedMeta) {
        toast.error('Bitcoin metadata not found in session', {
          description: 'The symmetric key and Nostr event ID are required for refresh. These are only available in the session where Bitcoin was initially set up.'
        });
        return;
      }

      // Perform client-side refresh
      const result = await refreshBitcoinClient({
        ownerKeypair,
        recipientPubkey: hex.decode(utxo.recipientPubkey),
        currentUtxo: {
          txId: utxo.txId,
          outputIndex: utxo.outputIndex,
          amountSats: utxo.amountSats,
        },
        currentScript: hex.decode(utxo.timelockScript),
        ttlBlocks: utxo.ttlBlocks,
        feeRateSatsPerVbyte: 10, // Default fee rate
        symmetricKeyK: hex.decode(storedMeta.symmetricKeyK),
        nostrEventId: storedMeta.nostrEventId,
        recipientPrivkey: recipientKeypair.privkey,
        recipientAddress: storedMeta.recipientAddress,
        network,
      });

      // Store results on server
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const storeResponse = await fetch(`/api/secrets/${secretId}/store-bitcoin-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          newTxId: result.newTxId,
          newOutputIndex: result.newOutputIndex,
          newAmountSats: result.newAmountSats,
          newTimelockScript: hex.encode(result.newTimelockScript),
          ttlBlocks: utxo.ttlBlocks,
          preSignedRecipientTx: result.preSignedRecipientTx,
          network,
        })
      });

      if (!storeResponse.ok) {
        const data = await storeResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to store refresh results');
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
      {#if statusData?.utxo}
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
    {:else if !statusData?.enabled}
      <p class="text-muted-foreground text-sm">
        No Bitcoin timelock configured for this secret.
      </p>
    {:else if statusData?.utxo}
      <div class="space-y-3 text-sm">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Amount locked</span>
          <span class="font-medium">{statusData.utxo.amountSats.toLocaleString()} sats</span>
        </div>

        <div class="flex justify-between">
          <span class="text-muted-foreground">Transaction</span>
          <span class="max-w-[200px] truncate font-mono text-xs">{statusData.utxo.txId}</span>
        </div>

        <div class="flex justify-between">
          <span class="text-muted-foreground">CSV delay</span>
          <span>{statusData.utxo.ttlBlocks.toLocaleString()} blocks</span>
        </div>

        {#if statusData.refreshesRemaining != null}
          <div class="flex justify-between">
            <span class="text-muted-foreground">Refreshes remaining</span>
            <span>{statusData.refreshesRemaining}</span>
          </div>
        {/if}

        {#if estimatedTimeRemaining}
          <Separator />
          <div class="flex items-center gap-2">
            <Clock class="text-muted-foreground h-4 w-4" />
            <div>
              <span class="font-medium">Time remaining: {estimatedTimeRemaining}</span>
            </div>
          </div>
        {/if}

        {#if statusData.utxo.status === 'expired'}
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
  {#if canRefresh}
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
