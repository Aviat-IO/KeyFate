<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { getMaxShares } from '$lib/tier-validation';
  import { Crown, Info } from '@lucide/svelte';

  let {
    sharesTotalValue = $bindable(3),
    thresholdValue = $bindable(2),
    isPro,
    isSubmitting = false,
    onUpgradeClick,
    sharesTotalError,
    thresholdError
  }: {
    sharesTotalValue: number;
    thresholdValue: number;
    isPro: boolean;
    isSubmitting?: boolean;
    onUpgradeClick?: () => void;
    sharesTotalError?: string;
    thresholdError?: string;
  } = $props();

  let maxShares = $derived(getMaxShares(isPro ? 'pro' : 'free'));
</script>

{#if !isPro}
  <div class="space-y-4">
    <Alert.Root>
      <Info class="h-4 w-4" />
      <Alert.Description>
        <div class="flex items-start justify-between gap-2">
          <div>
            <strong>Security Configuration:</strong> 2-of-3 shares (standard)
            <p class="text-muted-foreground mt-1 text-sm">
              Your secret will be split into 3 shares, requiring any 2 to reconstruct. Upgrade to
              Pro for configurable threshold schemes up to 7 shares.
            </p>
          </div>
          {#if onUpgradeClick}
            <button
              type="button"
              onclick={onUpgradeClick}
              class="text-primary flex items-center gap-1 whitespace-nowrap text-sm hover:underline"
            >
              <Crown class="h-3 w-3" />
              Upgrade
            </button>
          {/if}
        </div>
      </Alert.Description>
    </Alert.Root>
  </div>
{:else}
  <div class="space-y-4">
    <Alert.Root>
      <Info class="h-4 w-4" />
      <Alert.Description>
        <strong>Pro Feature:</strong> Configure your security threshold
        <p class="text-muted-foreground mt-1 text-sm">
          Choose how many shares to create (3-{maxShares}) and how many are required to reconstruct
          your secret (2 to total shares).
        </p>
      </Alert.Description>
    </Alert.Root>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <div class="space-y-2">
        <Label for="sss_shares_total">Total Shares to Create</Label>
        <Input
          id="sss_shares_total"
          type="number"
          min={3}
          max={maxShares}
          disabled={isSubmitting}
          bind:value={sharesTotalValue}
        />
        <p class="text-muted-foreground text-xs">
          Total shares to split the secret into. Min 3, Max {maxShares}.
        </p>
        {#if sharesTotalError}
          <p class="text-destructive text-xs">{sharesTotalError}</p>
        {/if}
      </div>

      <div class="space-y-2">
        <Label for="sss_threshold">Shares Needed for Recovery (Threshold)</Label>
        <Input
          id="sss_threshold"
          type="number"
          min={2}
          max={maxShares}
          disabled={isSubmitting}
          bind:value={thresholdValue}
        />
        <p class="text-muted-foreground text-xs">
          Minimum shares to reconstruct. Min 2, Max {maxShares}. Must be &lt;= total shares.
        </p>
        {#if thresholdError}
          <p class="text-destructive text-xs">{thresholdError}</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
