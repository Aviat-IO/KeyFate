<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  $effect(() => {
    if (!browser) return;
    const params = $page.url.searchParams.toString();
    window.location.href = `/sign-in${params ? `?${params}` : ''}`;
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
