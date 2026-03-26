<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { onMount } from 'svelte';

  let {
    onSuccess,
    onError,
    onExpire
  }: {
    onSuccess: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
  } = $props();

  let container: HTMLDivElement;
  let widgetId: string | undefined;

  const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY;

  onMount(() => {
    if (!siteKey) {
      // Dev bypass
      const timeoutId = setTimeout(() => onSuccess('dev-bypass-token'), 100);
      return () => clearTimeout(timeoutId);
    }

    // Load Turnstile script if not already loaded
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      renderWidget();
    }

    return () => {
      if (widgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetId);
      }
    };
  });

  function renderWidget() {
    if (!siteKey || !container || !(window as any).turnstile) return;

    widgetId = (window as any).turnstile.render(container, {
      sitekey: siteKey,
      callback: (token: string) => onSuccess(token),
      'error-callback': () => onError?.(),
      'expired-callback': () => onExpire?.(),
      theme: 'auto',
      size: 'normal'
    });
  }

  export function reset() {
    if (widgetId && (window as any).turnstile) {
      (window as any).turnstile.reset(widgetId);
    }
  }
</script>

{#if siteKey}
  <div class="flex justify-center">
    <div bind:this={container}></div>
  </div>
{/if}
