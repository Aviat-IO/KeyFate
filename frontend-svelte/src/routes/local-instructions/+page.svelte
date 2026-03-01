<script lang="ts">
  import { page } from '$app/stores';
  import NavBar from '$lib/components/NavBar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Alert from '$lib/components/ui/alert';
  import { Check, Copy, Download, Shield, Terminal } from 'lucide-svelte';

  let session = $derived($page.data.session);
  let copiedStates = $state<Record<string, boolean>>({});

  async function handleCopy(id: string, code: string) {
    await navigator.clipboard.writeText(code);
    copiedStates[id] = true;
    setTimeout(() => { copiedStates[id] = false; }, 2000);
  }
</script>

<svelte:head><title>Run Locally - KeyFate</title></svelte:head>

<div class="bg-background min-h-screen">
  <div class="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
    <NavBar {session} />
  </div>

  <div class="mx-auto max-w-3xl px-6 py-12">
    <div class="mb-12">
      <h1 class="font-space mb-4 text-3xl font-light tracking-tight">Run Secret Sharing Tool Locally</h1>
      <p class="text-muted-foreground text-lg">For maximum security and privacy, run the Shamir's Secret Sharing tool on your own device</p>
    </div>

    <Alert.Root class="mb-12">
      <Shield class="h-4 w-4" />
      <Alert.Title>Why Run Locally?</Alert.Title>
      <Alert.Description>
        While our online tool runs entirely in your browser (client-side), running the tool locally provides absolute certainty that your shares never leave your device.
      </Alert.Description>
    </Alert.Root>

    <div class="space-y-12">
      <section>
        <div class="flex items-center gap-2 mb-4">
          <Download class="h-5 w-5 text-muted-foreground" />
          <h2 class="font-space text-xl font-bold tracking-tight">Option 1: Download Source Code</h2>
        </div>
        <p class="text-muted-foreground mb-4 text-sm">Get the exact same tool that powers this website</p>
        <div>
          <p class="text-xs text-muted-foregroundr font-medium mb-2">Clone the repository</p>
          <div class="bg-muted relative rounded-lg border">
            <code class="bg-background block overflow-x-auto whitespace-pre-line rounded p-4 font-mono text-sm">git clone https://github.com/accolver/dead-mans-switch.git</code>
            <Button variant="ghost" size="icon" class="absolute right-2 top-2 h-8 w-8" onclick={() => handleCopy('clone', 'git clone https://github.com/accolver/dead-mans-switch.git')}>
              {#if copiedStates['clone']}<Check class="h-4 w-4" />{:else}<Copy class="h-4 w-4" />{/if}
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-center gap-2 mb-4">
          <Terminal class="h-5 w-5 text-muted-foreground" />
          <h2 class="font-space text-xl font-bold tracking-tight">Option 2: Use the Core Library</h2>
        </div>
        <p class="text-muted-foreground mb-4 text-sm">Use the same shamirs-secret-sharing library we use</p>
        <div>
          <p class="text-xs text-muted-foregroundr font-medium mb-2">Install the library</p>
          <div class="bg-muted relative rounded-lg border">
            <code class="bg-background block overflow-x-auto whitespace-pre-line rounded p-4 font-mono text-sm">npm install shamirs-secret-sharing</code>
            <Button variant="ghost" size="icon" class="absolute right-2 top-2 h-8 w-8" onclick={() => handleCopy('install', 'npm install shamirs-secret-sharing')}>
              {#if copiedStates['install']}<Check class="h-4 w-4" />{:else}<Copy class="h-4 w-4" />{/if}
            </Button>
          </div>
        </div>
      </section>
    </div>

    <div class="mt-12 text-center">
      <Button href="/decrypt">Try the Online Tool (Educational Purposes)</Button>
    </div>
  </div>

  <Footer />
</div>
