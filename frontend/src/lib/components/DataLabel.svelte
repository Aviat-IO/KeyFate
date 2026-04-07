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
	<dt class="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</dt>
	{#if children}
		<dd class="text-foreground mt-1 text-sm">
			{@render children()}
		</dd>
	{:else if value !== undefined && value !== null}
		<dd class="text-foreground mt-1 text-sm">{value}</dd>
	{/if}
</div>
