<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/stores';

	let {
		lookupKey,
		children,
		disabled = false
	}: {
		lookupKey: string;
		children: Snippet;
		disabled?: boolean;
	} = $props();

	let loading = $state(false);
	let resumeStarted = $state(false);

	const session = $derived($page.data.session);

	$effect(() => {
		const shouldResume =
			session?.user &&
			$page.url.searchParams.get('resume_checkout') === 'stripe' &&
			$page.url.searchParams.get('plan') === lookupKey;
		if (shouldResume && !resumeStarted) {
			resumeStarted = true;
			void handleCheckout();
		}
	});

	async function handleCheckout() {
		loading = true;

		try {
			if (!session?.user) {
				const checkoutUrl = `/pricing?resume_checkout=stripe&plan=${encodeURIComponent(lookupKey)}`;
				const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(checkoutUrl)}`;
				window.location.href = loginUrl;
				return;
			}

			const csrfRes = await fetch('/api/csrf-token');
			const { token } = await csrfRes.json();

			const response = await fetch('/api/create-checkout-session', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': token
				},
				body: JSON.stringify({ plan: lookupKey })
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: 'Unknown error' }));
				throw new Error(error.error || 'Failed to create checkout session');
			}

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error('No checkout URL returned from API');
			}
		} catch (error) {
			console.error('Error creating checkout:', error);
			alert('Failed to start checkout. Please try again.');
		} finally {
			loading = false;
		}
	}
</script>

<Button onclick={handleCheckout} disabled={disabled || loading} class="w-full">
	{#if loading}
		Loading...
	{:else}
		{@render children()}
	{/if}
</Button>
