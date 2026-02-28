<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    const token = $page.url.searchParams.get('token');
    const type = $page.url.searchParams.get('type');

    let redirectPath = '/auth/verify-email';
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (type) params.set('type', type);

    if (params.toString()) {
      redirectPath += `?${params.toString()}`;
    }

    goto(redirectPath, { replaceState: true });
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="text-center">
    <h2 class="text-center text-3xl font-bold tracking-tight">
      Redirecting to email verification...
    </h2>
    <p class="text-muted-foreground mt-2 text-center text-sm">
      Please wait while we redirect you to the new verification page.
    </p>
  </div>
</div>
