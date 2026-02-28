<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { page } from '$app/stores';

  let { children } = $props();
  let session = $derived($page.data.session);
</script>

<div class="bg-background min-h-screen">
  <div
    class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
  >
    <NavBar {session} />
  </div>
  {@render children()}
  <Footer />
</div>
