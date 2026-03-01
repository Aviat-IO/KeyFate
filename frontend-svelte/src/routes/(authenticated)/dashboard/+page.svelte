<script lang="ts">
	import SecretsGrid from '$lib/components/SecretsGrid.svelte';
	import { Button } from '$lib/components/ui/button';

	let { data } = $props();

	let secrets = $derived(data.secrets);
	let hasSecrets = $derived(secrets.length > 0);
</script>

<svelte:head>
	<title>Dashboard - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-12">
	<div class="mb-10 flex items-end justify-between">
		<h1 class="font-space text-3xl font-light tracking-tight md:text-4xl">Your Secrets</h1>
		<Button variant="outline" href="/secrets/new" class="uppercase tracking-wide font-semibold">
			Create New Secret
		</Button>
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
				<Button href="/secrets/new" class="uppercase tracking-wide font-semibold">
					Create Your First Secret
				</Button>
			</div>
		</div>
	{/if}
</div>
