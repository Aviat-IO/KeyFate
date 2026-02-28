<script lang="ts">
	import DataExportCard from '$lib/components/DataExportCard.svelte';
	import AccountDeletionCard from '$lib/components/AccountDeletionCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Data & Privacy - KeyFate</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Data & Privacy</h2>
		<p class="text-muted-foreground">Manage your personal data, exports, and account deletion</p>
	</div>

	<DataExportCard recentExports={data.recentExports} />

	<AccountDeletionCard activeDeletionRequest={data.activeDeletionRequest} />
</div>
