<script lang="ts">
	import SecretsGrid from '$lib/components/SecretsGrid.svelte';
	import UpgradeModal from '$lib/components/UpgradeModal.svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	let secrets = $derived(data.secrets);
	let hasSecrets = $derived(secrets.length > 0);
	let canCreate = $derived(data.canCreate);
	let showUpgradeModal = $state(false);
</script>

<svelte:head>
	<title>Dashboard - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-12">
	<div class="mb-10 flex items-end justify-between">
		<h1 class="font-space text-3xl font-light tracking-tight md:text-4xl">Your Secrets</h1>
		{#if canCreate}
			<Button variant="outline" href="/secrets/new" class="font-semibold">
				Create New Secret
			</Button>
		{:else}
			<Button variant="outline" class="font-semibold" onclick={() => (showUpgradeModal = true)}>
				Create New Secret
			</Button>
		{/if}
	</div>

	{#if hasSecrets}
		<SecretsGrid {secrets} />
	{:else}
		<!-- Unboxed empty state — no Card wrapper -->
		<div class="py-16 text-center">
			<h2 class="font-space text-2xl font-light tracking-tight">No Secrets Yet</h2>
			<p class="text-muted-foreground mt-4 max-w-md mx-auto text-sm">
				You haven't created any secrets yet. Get started by creating your first dead man's switch.
			</p>
			<div class="mt-8">
				{#if canCreate}
					<Button href="/secrets/new" class="font-semibold">
						Create Your First Secret
					</Button>
				{:else}
					<Button class="font-semibold" onclick={() => (showUpgradeModal = true)}>
						Create Your First Secret
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<UpgradeModal
	bind:open={showUpgradeModal}
	onOpenChange={(open) => (showUpgradeModal = open)}
	feature="more secrets"
	currentLimit="1 secret"
	proLimit="Up to 10 secrets"
/>
