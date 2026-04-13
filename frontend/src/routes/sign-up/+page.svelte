<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { buildSignUpRedirectUrl } from '$lib/auth/redirect-callers';

	$effect(() => {
		if (!browser) return;

		window.location.href = buildSignUpRedirectUrl($page.url);
	});
</script>

<svelte:head>
	<title>Sign Up | KeyFate</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center">
	<div class="text-center">
		<div class="text-muted-foreground mb-4 text-lg">Redirecting to sign in...</div>
		<div
			class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
		></div>
	</div>
</div>
