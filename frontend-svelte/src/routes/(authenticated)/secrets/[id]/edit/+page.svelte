<script lang="ts">
	import EditSecretForm from '$lib/components/EditSecretForm.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Edit Secret - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-3xl py-8 sm:px-4">
	<h1 class="mb-8 text-left text-2xl font-bold">Edit Secret</h1>
	<EditSecretForm initialData={data.initialData} secretId={data.secretId} />
</div>
