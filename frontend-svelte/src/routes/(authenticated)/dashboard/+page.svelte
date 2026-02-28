<script lang="ts">
	import SecretsGrid from '$lib/components/SecretsGrid.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { data } = $props();

	let secrets = $derived(data.secrets);
	let hasSecrets = $derived(secrets.length > 0);
</script>

<svelte:head>
	<title>Dashboard - KeyFate</title>
</svelte:head>

<div class="container mx-auto py-8 sm:px-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Your Secrets</h1>
		<Button variant="outline" href="/secrets/new">Create New Secret</Button>
	</div>

	{#if hasSecrets}
		<SecretsGrid {secrets} />
	{:else}
		<div class="mx-auto max-w-2xl">
			<Card.Root>
				<Card.Header>
					<Card.Title>No Secrets Yet</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-muted-foreground mb-4">
						You haven't created any secrets yet. Get started by creating your first dead man's
						switch.
					</p>
					<Button href="/secrets/new">Create Your First Secret</Button>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
