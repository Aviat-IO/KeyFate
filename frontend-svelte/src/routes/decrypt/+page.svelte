<script lang="ts">
  import { page } from '$app/stores';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import SSSDecryptor from '$lib/components/SSSDecryptor.svelte';

  let session = $derived($page.data.session);

  // Extract shares from URL query parameters (share1, share2, share3, etc.)
  let initialShares = $derived.by(() => {
    const shares: string[] = [];
    let index = 1;
    while (true) {
      const value = $page.url.searchParams.get(`share${index}`);
      if (value) {
        shares.push(value);
        index++;
      } else {
        break;
      }
    }
    return shares;
  });
</script>

<svelte:head>
  <title>Recover Secret - KeyFate</title>
  <meta
    name="description"
    content="Reconstruct your secret using Shamir's Secret Sharing. Enter your shares to recover the original secret — all processing happens in your browser."
  />
</svelte:head>

<div class="bg-background min-h-screen">
  <div
    class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur"
  >
    <NavBar {session} />
  </div>

  <div class="mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
    <div class="w-full max-w-3xl">
      <SSSDecryptor {initialShares} />
    </div>
  </div>

  <Footer />
</div>
