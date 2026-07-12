<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Bitcoin } from '@lucide/svelte';
	import { page } from '$app/stores';

	let {
		interval = 'monthly',
		children,
		disabled = false
	}: {
		interval?: 'monthly' | 'yearly';
		children: Snippet;
		disabled?: boolean;
	} = $props();

	let loading = $state(false);
	let resumeStarted = $state(false);

	const session = $derived($page.data.session);
	const plan = $derived(interval === 'yearly' ? 'pro_yearly' : 'pro_monthly');

	$effect(() => {
		const shouldResume =
			session?.user &&
			$page.url.searchParams.get('resume_checkout') === 'btcpay' &&
			$page.url.searchParams.get('plan') === plan;
		if (shouldResume && !resumeStarted) {
			resumeStarted = true;
			void handleCheckout();
		}
	});

	async function handleCheckout() {
		loading = true;

		try {
			if (!session?.user) {
				const returnUrl = `/pricing?resume_checkout=btcpay&plan=${plan}`;
				const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`;
				window.location.href = loginUrl;
				return;
			}

			const csrfRes = await fetch('/api/csrf-token');
			const { token } = await csrfRes.json();

			const response = await fetch('/api/create-btcpay-checkout', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-csrf-token': token
				},
				body: JSON.stringify({ plan })
			});

			if (response.ok) {
				const { url } = await response.json();
				window.location.href = url;
			} else if (response.status === 401) {
				const returnUrl = `/pricing?resume_checkout=btcpay&plan=${plan}`;
				const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`;
				window.location.href = loginUrl;
			} else {
				const res = await response.json();
				console.error('BTCPay checkout failed', res);
			}
		} catch (error) {
			console.error('Error:', error);
		} finally {
			loading = false;
		}
	}
</script>

<Button onclick={handleCheckout} disabled={disabled || loading} class="w-full" variant="default">
	<Bitcoin class="mr-2 h-4 w-4" />
	{#if loading}
		Loading...
	{:else}
		{@render children()}
	{/if}
</Button>
