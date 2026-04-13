<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { buildAuthLoginRedirectPath } from '$lib/auth/redirect-callers';
	import { onMount } from 'svelte';

	onMount(() => {
		const redirectPath = buildAuthLoginRedirectPath($page.url);
		goto(redirectPath, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Sign In | KeyFate</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div>Redirecting to sign in...</div>
</div>
