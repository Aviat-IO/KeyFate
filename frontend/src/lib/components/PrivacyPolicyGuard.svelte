<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let needsAcceptance = $state(false);
  let isAccepting = $state(false);
  let error = $state('');

  $effect(() => {
    const session = $page.data.session;
    if (session?.user) {
      checkAcceptance();
    }
  });

  async function checkAcceptance() {
    try {
      const response = await fetch('/api/auth/check-privacy-policy');
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to check privacy policy status');
        return;
      }

      needsAcceptance = !data.accepted;
    } catch (err) {
      console.error('Error checking privacy policy:', err);
    }
  }

  async function handleAccept() {
    isAccepting = true;
    error = '';

    try {
      const response = await fetch('/api/auth/accept-privacy-policy', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to record acceptance');
      }

      needsAcceptance = false;
    } catch (err) {
      console.error('Error accepting privacy policy:', err);
      error = 'Failed to record acceptance. Please try again.';
    } finally {
      isAccepting = false;
    }
  }
</script>

{#if needsAcceptance}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-card border-border mx-4 max-w-lg rounded-xl border p-6 shadow-xl">
      <h2 class="text-foreground mb-4 text-2xl font-bold">Privacy Policy Update</h2>
      <p class="text-muted-foreground mb-4 text-sm">
        We've updated our Privacy Policy. Please review and accept the changes to continue using
        KeyFate.
      </p>

      <div class="mb-6 space-y-2">
        <a
          href="/privacy-policy"
          target="_blank"
          class="text-primary block text-sm hover:underline"
        >
          Read Privacy Policy
        </a>
        <a
          href="/terms-of-service"
          target="_blank"
          class="text-primary block text-sm hover:underline"
        >
          Read Terms of Service
        </a>
      </div>

      {#if error}
        <div
          class="border-destructive bg-destructive/10 text-destructive mb-4 rounded border p-2 text-sm"
        >
          {error}
        </div>
      {/if}

      <Button onclick={handleAccept} disabled={isAccepting} class="w-full">
        {isAccepting ? 'Accepting...' : 'I Accept'}
      </Button>
    </div>
  </div>
{:else}
  {@render children()}
{/if}
