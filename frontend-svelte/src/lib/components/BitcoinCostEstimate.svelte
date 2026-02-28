<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { Bitcoin, Calculator } from '@lucide/svelte';

  let {
    checkInDays = 30,
    feeRateSatsPerVbyte = 10,
    initialAmountSats = 50000,
    class: className
  }: {
    /** Check-in frequency in days */
    checkInDays?: number;
    /** Current estimated fee rate (sat/vbyte) */
    feeRateSatsPerVbyte?: number;
    /** Initial UTXO amount in sats */
    initialAmountSats?: number;
    class?: string;
  } = $props();

  // Constants matching the transaction module estimates
  const CREATION_VBYTES = 153;
  const REFRESH_VBYTES = 204;
  const RECIPIENT_VBYTES = 267;
  const MIN_UTXO_SATS = 10_000;

  let creationFeeSats = $derived(Math.ceil(CREATION_VBYTES * feeRateSatsPerVbyte));
  let refreshFeeSats = $derived(Math.ceil(REFRESH_VBYTES * feeRateSatsPerVbyte));
  let recipientFeeSats = $derived(Math.ceil(RECIPIENT_VBYTES * feeRateSatsPerVbyte));

  let refreshesPerYear = $derived(checkInDays > 0 ? Math.ceil(365 / checkInDays) : 0);
  let annualRefreshCostSats = $derived(refreshesPerYear * refreshFeeSats);
  let totalFirstYearSats = $derived(creationFeeSats + annualRefreshCostSats);

  let refreshesRemaining = $derived.by(() => {
    let remaining = initialAmountSats;
    let count = 0;
    while (remaining - refreshFeeSats >= MIN_UTXO_SATS) {
      remaining -= refreshFeeSats;
      count++;
    }
    return count;
  });

  let estimatedYearsOfService = $derived.by(() => {
    if (refreshesPerYear === 0) return 0;
    return Math.floor(refreshesRemaining / refreshesPerYear);
  });

  function formatSats(sats: number): string {
    return sats.toLocaleString();
  }

  function satsToBtc(sats: number): string {
    return (sats / 100_000_000).toFixed(8);
  }
</script>

<div class={className}>
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Calculator class="h-5 w-5" />
        Bitcoin Cost Estimate
      </Card.Title>
      <Card.Description>
        Estimated costs for the Bitcoin dead man's switch based on current parameters.
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <!-- Parameters -->
      <div class="bg-muted/50 rounded-lg p-3">
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide">Parameters</h4>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <span class="text-muted-foreground">Check-in frequency</span>
          <span class="text-right font-medium">Every {checkInDays} days</span>
          <span class="text-muted-foreground">Fee rate</span>
          <span class="text-right font-medium">{feeRateSatsPerVbyte} sat/vbyte</span>
          <span class="text-muted-foreground">Initial UTXO</span>
          <span class="text-right font-medium">{formatSats(initialAmountSats)} sats</span>
        </div>
      </div>

      <Separator />

      <!-- Fee breakdown -->
      <div>
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide">Fee Breakdown</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Creation tx (~{CREATION_VBYTES} vbytes)</span>
            <span class="font-mono">{formatSats(creationFeeSats)} sats</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Each refresh tx (~{REFRESH_VBYTES} vbytes)</span>
            <span class="font-mono">{formatSats(refreshFeeSats)} sats</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Recipient tx (~{RECIPIENT_VBYTES} vbytes)</span>
            <span class="font-mono">{formatSats(recipientFeeSats)} sats</span>
          </div>
        </div>
      </div>

      <Separator />

      <!-- Annual cost -->
      <div>
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide">Annual Cost</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Refreshes per year</span>
            <span class="font-medium">{refreshesPerYear}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Annual refresh cost</span>
            <span class="font-mono">{formatSats(annualRefreshCostSats)} sats</span>
          </div>
          <div class="flex justify-between font-medium">
            <span>Total first year (creation + refreshes)</span>
            <span class="font-mono">{formatSats(totalFirstYearSats)} sats</span>
          </div>
          <div class="text-muted-foreground flex justify-between text-xs">
            <span></span>
            <span>≈ {satsToBtc(totalFirstYearSats)} BTC</span>
          </div>
        </div>
      </div>

      <Separator />

      <!-- UTXO longevity -->
      <div>
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide">UTXO Longevity</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Refreshes remaining</span>
            <span class="font-medium">{refreshesRemaining}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Estimated service life</span>
            <span class="font-medium">
              {#if estimatedYearsOfService > 0}
                ~{estimatedYearsOfService} year{estimatedYearsOfService !== 1 ? 's' : ''}
              {:else}
                Less than 1 year
              {/if}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      <!-- Notes -->
      <div class="space-y-2 text-xs">
        <div class="flex items-start gap-2">
          <Bitcoin class="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
          <p class="text-muted-foreground">
            <strong>Minimum UTXO:</strong> {formatSats(MIN_UTXO_SATS)} sats. The UTXO must stay
            above this threshold after each refresh. When depleted, add more funds.
          </p>
        </div>
        <div class="flex items-start gap-2">
          <Bitcoin class="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
          <p class="text-muted-foreground">
            <strong>Fee variability:</strong> Bitcoin fees fluctuate with network demand.
            During high-fee periods, refresh costs may be 10-100x higher. Consider using
            a higher initial UTXO amount for safety margin.
          </p>
        </div>
        <div class="flex items-start gap-2">
          <Bitcoin class="text-muted-foreground mt-0.5 h-3 w-3 shrink-0" />
          <p class="text-muted-foreground">
            <strong>Refresh deducts fees:</strong> Each check-in refresh deducts the
            transaction fee from the UTXO balance. The UTXO shrinks over time.
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</div>
