<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import * as Select from '$lib/components/ui/select';
  import { toast } from 'svelte-sonner';
  import { AlertTriangle, Bitcoin, Loader2 } from '@lucide/svelte';

  let {
    secretId,
    onSetupComplete
  }: {
    secretId: string;
    onSetupComplete?: (data: { txid: string; amount: number; csvBlocks: number }) => void;
  } = $props();

  let loading = $state(false);
  let amount = $state(10000);
  let feePriority = $state<string>('medium');

  let isValid = $derived(amount >= 546 && amount <= 10_000_000);

  const feeEstimates: Record<string, { label: string; rate: number }> = {
    low: { label: 'Low (~60 min)', rate: 5 },
    medium: { label: 'Medium (~30 min)', rate: 15 },
    high: { label: 'High (~10 min)', rate: 30 }
  };

  let estimatedFee = $derived(feeEstimates[feePriority]?.rate ?? 15);
  let totalCost = $derived(amount + estimatedFee * 150);

  async function handleSubmit() {
    if (!isValid) return;
    loading = true;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secretId}/enable-bitcoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          amount,
          fee_priority: feePriority
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to enable Bitcoin timelock');
      }

      const result = await response.json();
      toast.success('Bitcoin timelock enabled');
      onSetupComplete?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message, { description: 'Bitcoin setup failed' });
    } finally {
      loading = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Bitcoin class="h-5 w-5" />
      Bitcoin Timelock Setup
    </Card.Title>
    <Card.Description>
      Lock BTC in a timelock transaction. If you stop checking in, the funds become spendable by
      your recipient after the CSV delay expires.
    </Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <Alert.Root>
      <AlertTriangle class="h-4 w-4" />
      <Alert.Description class="text-xs">
        <strong>Warning:</strong> Locked BTC cannot be recovered until the timelock expires. Ensure you
        understand the fee costs and CSV delay before proceeding.
      </Alert.Description>
    </Alert.Root>

    <div class="space-y-2">
      <Label for="btc-amount">Amount (sats)</Label>
      <Input
        id="btc-amount"
        type="number"
        min={546}
        max={10_000_000}
        bind:value={amount}
        disabled={loading}
        placeholder="10000"
      />
      {#if amount < 546}
        <p class="text-destructive text-xs">Minimum amount is 546 sats (dust limit).</p>
      {:else if amount > 10_000_000}
        <p class="text-destructive text-xs">Maximum amount is 10,000,000 sats.</p>
      {:else}
        <p class="text-muted-foreground text-xs">
          {(amount / 100_000_000).toFixed(8)} BTC
        </p>
      {/if}
    </div>

    <div class="space-y-2">
      <Label for="fee-priority">Fee Priority</Label>
      <Select.Root type="single" bind:value={feePriority}>
        <Select.Trigger id="fee-priority">
          <span>{feeEstimates[feePriority]?.label ?? 'Select priority'}</span>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="low">{feeEstimates.low.label} (~{feeEstimates.low.rate} sat/vB)</Select.Item>
          <Select.Item value="medium">{feeEstimates.medium.label} (~{feeEstimates.medium.rate} sat/vB)</Select.Item>
          <Select.Item value="high">{feeEstimates.high.label} (~{feeEstimates.high.rate} sat/vB)</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>

    <div class="bg-muted/50 rounded-lg p-3">
      <h4 class="mb-2 text-sm font-medium">Estimated Cost Breakdown</h4>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Lock amount</span>
          <span>{amount.toLocaleString()} sats</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Est. tx fee (~150 vB)</span>
          <span>{(estimatedFee * 150).toLocaleString()} sats</span>
        </div>
        <div class="border-t pt-1">
          <div class="flex justify-between font-medium">
            <span>Total</span>
            <span>{totalCost.toLocaleString()} sats</span>
          </div>
        </div>
      </div>
    </div>
  </Card.Content>
  <Card.Footer>
    <Button onclick={handleSubmit} disabled={loading || !isValid} class="w-full">
      {#if loading}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
        Enabling Timelock...
      {:else}
        <Bitcoin class="mr-2 h-4 w-4" />
        Enable Bitcoin Timelock
      {/if}
    </Button>
  </Card.Footer>
</Card.Root>
