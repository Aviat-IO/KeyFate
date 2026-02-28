<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/sign-in?error=Password reset feature has been updated. Please use the new sign-in flow.', {
      replaceState: true
    });
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="text-center">
    <h2 class="text-center text-3xl font-bold tracking-tight">Redirecting...</h2>
    <p class="text-muted-foreground mt-2 text-center text-sm">
      This feature has been updated. Redirecting to sign-in page.
    </p>
  </div>
</div>
