<script lang="ts">
  import { page } from '$app/stores';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let session = $derived($page.data.session);

  // TODO: Port SssDecryptor component — handled by feature components subagent
</script>

<svelte:head>
  <title>Recover Secret - KeyFate</title>
</svelte:head>

<div class="bg-background min-h-screen">
  <div
    class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
  >
    <NavBar {session} />
  </div>

  <div class="mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-0 py-12 sm:px-4">
    <div class="w-full max-w-2xl">
      <div class="text-center">
        <h1 class="mb-4 text-3xl font-bold">Recover Your Secret</h1>
        <p class="text-muted-foreground mb-8">
          Enter your secret shares below to reconstruct your original secret using Shamir's Secret
          Sharing.
        </p>
        <!-- SssDecryptor component will be ported by feature components subagent -->
        <p class="text-muted-foreground text-sm">Decryptor component loading...</p>
      </div>
    </div>
  </div>

  <Footer />
</div>
