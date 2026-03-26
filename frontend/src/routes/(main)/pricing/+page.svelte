<script lang="ts">
	import PricingPage from '$lib/components/PricingPage.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Pricing - KeyFate</title>
</svelte:head>

<div class="container mx-auto px-4 py-16">
	<PricingPage userTier={data.userTier} userTierDisplayName={data.userTierDisplayName} />
</div>
