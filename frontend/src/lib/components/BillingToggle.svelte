<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';

  let {
    billingPeriod,
    onPeriodChange,
    class: className = ''
  }: {
    billingPeriod: 'monthly' | 'yearly';
    onPeriodChange: (period: 'monthly' | 'yearly') => void;
    class?: string;
  } = $props();
</script>

<div class="flex justify-center {className}">
  <div class="bg-secondary rounded-lg p-1">
    <button
      onclick={() => onPeriodChange('monthly')}
      class="rounded-md px-4 py-2 text-sm font-medium transition-colors {billingPeriod ===
      'monthly'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
    >
      Monthly
    </button>
    <button
      onclick={() => onPeriodChange('yearly')}
      class="rounded-md px-4 py-2 text-sm font-medium transition-colors {billingPeriod ===
      'yearly'
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'}"
    >
      Yearly
      <Badge class="bg-success text-success-foreground ml-2 text-xs">Save 17%</Badge>
    </button>
  </div>
</div>
