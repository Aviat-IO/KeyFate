<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $effect(() => {
    if (!browser) return;
    const callbackUrl = $page.url.searchParams.get('callbackUrl');
    const next = $page.url.searchParams.get('next');

    let redirectUrl = '/auth/signin';
    const params = new URLSearchParams();
    if (callbackUrl) params.set('callbackUrl', callbackUrl);
    if (next) params.set('next', next);
    if (params.toString()) redirectUrl += `?${params.toString()}`;

    window.location.href = redirectUrl;
  });
</script>

<div class="bg-background flex min-h-screen items-center justify-center">
  <div class="text-center">
    <div class="text-muted-foreground mb-4 text-lg">Redirecting to sign in...</div>
    <div
      class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
    ></div>
  </div>
</div>
