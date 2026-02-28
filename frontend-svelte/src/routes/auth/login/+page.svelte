<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    const nextUrl = $page.url.searchParams.get('next');
    const redirectPath = nextUrl
      ? `/sign-in?callbackUrl=${encodeURIComponent(nextUrl)}`
      : '/sign-in';
    goto(redirectPath, { replaceState: true });
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div>Redirecting to sign in...</div>
</div>
