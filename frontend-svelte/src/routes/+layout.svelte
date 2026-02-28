<script lang="ts">
  import '../app.css';
  import { Toaster } from '$lib/components/ui/sonner';

  let { children, data } = $props();
</script>

<svelte:head>
  <title>KeyFate</title>
  <meta name="description" content="Your key to peace of mind" />
</svelte:head>

{@render children()}
<Toaster />
