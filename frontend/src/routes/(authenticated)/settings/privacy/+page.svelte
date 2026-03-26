<script lang="ts">
	import DataExportCard from '$lib/components/DataExportCard.svelte';
	import AccountDeletionCard from '$lib/components/AccountDeletionCard.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Data & Privacy - KeyFate</title>
</svelte:head>

<div class="space-y-10">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">Data & Privacy</h2>
		<p class="text-sm text-muted-foreground mt-1">Manage your personal data, exports, and account deletion</p>
	</div>

	<DataExportCard recentExports={data.recentExports} />

	<AccountDeletionCard activeDeletionRequest={data.activeDeletionRequest} />
</div>
