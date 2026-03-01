<script lang="ts">
	import EditSecretForm from '$lib/components/EditSecretForm.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Edit Secret - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-6 py-12">
	<h1 class="font-space mb-10 text-3xl font-light tracking-tight">Edit Secret</h1>
	<EditSecretForm initialData={data.initialData} secretId={data.secretId} />
</div>
