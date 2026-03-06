<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
</script>

<div class="flex min-h-screen flex-col items-center justify-center">
  <h1 class="mb-4 text-4xl font-bold">Something went wrong!</h1>
  <p class="text-muted-foreground mb-4">
    {$page.error?.message || 'An unexpected error occurred'}
  </p>
  <p class="text-muted-foreground mb-6 text-sm">
    Status: {$page.status}
  </p>
  <Button href="/">Go Home</Button>
</div>
