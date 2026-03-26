<script lang="ts">
	import SubscriptionManager from '$lib/components/SubscriptionManager.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Subscription - KeyFate</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">Subscription</h2>
		<p class="text-sm text-muted-foreground mt-1">Manage your subscription and billing</p>
	</div>

	{#if data.tierInfo}
		<SubscriptionManager tierInfo={data.tierInfo} />
	{:else}
		<div class="border-destructive/50 rounded-lg border p-4">
			<p class="text-destructive text-sm">Error loading subscription information</p>
		</div>
	{/if}
</div>
