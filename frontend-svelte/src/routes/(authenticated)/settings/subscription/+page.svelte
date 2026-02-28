<script lang="ts">
	import SubscriptionManager from '$lib/components/SubscriptionManager.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Subscription - KeyFate</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Subscription</h2>
		<p class="text-muted-foreground">Manage your subscription and billing</p>
	</div>

	{#if data.tierInfo}
		<SubscriptionManager tierInfo={data.tierInfo} />
	{:else}
		<div class="border-destructive bg-destructive/10 rounded-lg border p-4">
			<p class="text-destructive text-sm">Error loading subscription information</p>
		</div>
	{/if}
</div>
