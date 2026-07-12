<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';

	let isLoading = $state(false);
	let isSuccessful = $state(false);
	let initialized = $state(false);
	let token = $state<string | null>(null);

	onMount(() => {
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		// Legacy query links remain usable during the migration, but all newly
		// issued links use fragments so proxies never receive the capability.
		token = fragment.get('token') ?? new URL(window.location.href).searchParams.get('token');
		window.history.replaceState({}, '', window.location.pathname);
		initialized = true;
	});

	async function handleCheckIn() {
		if (!token) return;
		isLoading = true;
		try {
			const response = await fetch('/api/check-in', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token })
			});

			const contentType = response.headers.get('content-type');
			if (!contentType?.includes('application/json')) {
				throw new Error('Server returned an error. Please try again or contact support.');
			}

			const data = await response.json();

			if (response.ok) {
				isSuccessful = true;
				toast.success('Check-in successful!', {
					description: data.message ?? `Next check-in: ${data.nextCheckIn}`,
					duration: 10000
				});
			} else {
				throw new Error(data.error || 'Check-in failed');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error('Check-in failed', { description: errorMessage });
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Check In | KeyFate</title>
</svelte:head>

<div class="mx-auto py-8 sm:px-4">
	{#if !initialized}
		<div class="text-muted-foreground mx-auto max-w-md pt-16 text-center">Loading…</div>
	{:else if !token}
		<div class="mx-auto max-w-md pt-16 text-center">
			<h1 class="text-destructive mb-4 text-2xl font-bold">Invalid Check-In Link</h1>
			<p class="text-muted-foreground">This check-in link is missing required information.</p>
		</div>
	{:else}
		<div class="mx-auto max-w-md space-y-6 pt-32 text-center">
			<h1 class="text-3xl font-bold">Secret Check-In</h1>

			<p class="text-muted-foreground">
				{#if isSuccessful}
					Your secret's timer has been successfully reset. You can close this page.
				{:else}
					Click the button below to check in and reset your secret's timer.
				{/if}
			</p>

			<Button onclick={handleCheckIn} disabled={isLoading || isSuccessful} size="lg" class="w-full">
				{#if isLoading}
					Checking in...
				{:else if isSuccessful}
					Check-in Complete
				{:else}
					Check In Now
				{/if}
			</Button>

			{#if !isSuccessful}
				<p class="text-muted-foreground text-sm">
					This will update your last check-in time and prevent your secret from being triggered.
				</p>
			{/if}
		</div>
	{/if}
</div>
