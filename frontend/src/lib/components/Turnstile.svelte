<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	interface TurnstileApi {
		render(
			container: HTMLElement,
			options: {
				sitekey: string;
				action: string;
				callback: (token: string) => void;
				'error-callback': () => void;
				'expired-callback': () => void;
				theme: 'auto';
				size: 'normal';
			}
		): string;
		reset(widgetId: string): void;
		remove(widgetId: string): void;
	}

	let {
		onSuccess,
		onError,
		onExpire,
		action = 'request-otp'
	}: {
		onSuccess: (token: string) => void;
		onError?: () => void;
		onExpire?: () => void;
		action?: string;
	} = $props();

	let container = $state<HTMLDivElement | undefined>();
	let widgetId: string | undefined;
	const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY;
	const publicEnvironment = (env.PUBLIC_ENV || 'development').toLowerCase();
	const allowsBypass = ['development', 'dev', 'local', 'test'].includes(publicEnvironment);

	function turnstile(): TurnstileApi | undefined {
		return (window as Window & { turnstile?: TurnstileApi }).turnstile;
	}

	function renderWidget(): void {
		const api = turnstile();
		if (!siteKey || !container || !api || widgetId) return;
		widgetId = api.render(container, {
			sitekey: siteKey,
			action,
			callback: onSuccess,
			'error-callback': () => onError?.(),
			'expired-callback': () => onExpire?.(),
			theme: 'auto',
			size: 'normal'
		});
	}

	onMount(() => {
		if (!siteKey) {
			if (!allowsBypass) {
				onError?.();
				return;
			}
			const timeoutId = setTimeout(() => onSuccess('dev-bypass-token'), 0);
			return () => clearTimeout(timeoutId);
		}

		const existing = document.querySelector<HTMLScriptElement>(
			'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
		);
		const script = existing ?? document.createElement('script');
		const load = () => renderWidget();
		if (!existing) {
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.defer = true;
			document.head.appendChild(script);
		}
		if (turnstile()) renderWidget();
		else script.addEventListener('load', load, { once: true });

		return () => {
			script.removeEventListener('load', load);
			const api = turnstile();
			if (widgetId && api) api.remove(widgetId);
			widgetId = undefined;
		};
	});

	export function reset(): void {
		const api = turnstile();
		if (widgetId && api) api.reset(widgetId);
	}
</script>

{#if siteKey}
	<div class="flex justify-center">
		<div bind:this={container}></div>
	</div>
{/if}
