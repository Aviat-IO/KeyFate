<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    value = undefined,
    children = undefined,
    class: className = ''
  }: {
    label: string;
    value?: string | number | null;
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class={className}>
  <dt class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
  {#if children}
    <dd class="mt-1 text-sm text-foreground">
      {@render children()}
    </dd>
  {:else if value !== undefined && value !== null}
    <dd class="mt-1 text-sm text-foreground">{value}</dd>
  {/if}
</div>
