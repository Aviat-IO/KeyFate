<script lang="ts">
  import type { Snippet } from 'svelte';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="bg-background min-h-screen">
  <div
    class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
  >
    <NavBar />
  </div>

  <main class="mx-auto max-w-5xl px-6 py-12">
    {@render children()}
  </main>

  <Footer />
</div>
